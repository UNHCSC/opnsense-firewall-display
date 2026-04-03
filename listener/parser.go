package listener

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/UNHCSC/opnsense-firewall-display/db"
)

func ParseFirewallSyslogLine(line string) (entry *db.FirewallLogEntry, err error) {
	var payload string
	entry = &db.FirewallLogEntry{}

	if payload, err = parseSyslogHeader(line, entry); err != nil {
		return
	}

	entry.RawFilterLog = payload
	entry.Extra = make(map[string]string)

	var fields []string = splitCSVPreserveEmpty(payload)
	if len(fields) < 9 {
		err = fmt.Errorf("not enough fields in filter log payload")
		return
	}

	entry.Rule = atoiDefault(fields[0], -1)
	entry.SubRule = fields[1]
	entry.Anchor = fields[2]
	entry.Tracker = fields[3]
	entry.Interface = fields[4]
	entry.Reason = fields[5]
	entry.Action = fields[6]
	entry.Direction = fields[7]
	entry.IPVersion = atoiDefault(fields[8], 0)

	switch entry.IPVersion {
	case 4:
		err = parseIPv4Fields(entry, fields)
	case 6:
		err = parseIPv6Fields(entry, fields)
	default:
		err = fmt.Errorf("unsupported ip version: %q", fields[8])
	}

	return
}

func parseSyslogHeader(line string, entry *db.FirewallLogEntry) (rest string, err error) {
	// Expected general shape:
	// <134>1 2026-03-31T18:17:09-04:00 titanium.cyber.lab filterlog 59301 - [meta sequenceId="3"] PAYLOAD

	if !strings.HasPrefix(line, "<") {
		err = fmt.Errorf("missing syslog priority prefix")
		return
	}

	var endPri int = strings.Index(line, ">")
	if endPri == -1 {
		err = fmt.Errorf("malformed syslog priority")
		return
	}

	// Let's try building it...
	entry.HeaderPriority = atoiDefault(line[1:endPri], -1)

	rest = line[endPri+1:]

	var sp int = strings.IndexByte(rest, ' ')
	if sp == -1 {
		err = fmt.Errorf("missing syslog version separator")
		return
	}

	entry.HeaderVersion = atoiDefault(rest[:sp], -1)
	rest = rest[sp+1:]

	var ts string
	if ts, rest, err = consumeToken(rest); err != nil {
		return
	} else {
		entry.HeaderTimestamp = timeStrToTime(ts)
	}

	if entry.HeaderHostname, rest, err = consumeToken(rest); err != nil {
		return
	}

	if entry.HeaderAppName, rest, err = consumeToken(rest); err != nil {
		return
	}

	if entry.HeaderProcID, rest, err = consumeToken(rest); err != nil {
		return
	}

	if entry.HeaderMsgID, rest, err = consumeToken(rest); err != nil {
		return
	}

	if entry.HeaderStructured, rest, err = consumeStructuredData(rest); err != nil {
		return
	}

	rest = strings.TrimSpace(rest)
	return
}

func consumeToken(segment string) (token string, rest string, err error) {
	if segment = strings.TrimLeft(segment, " "); segment == "" {
		err = fmt.Errorf("unexpected end of syslog header while parsing token")
		return
	}

	var before, after, ok = strings.Cut(segment, " ")
	if !ok {
		token = segment
		rest = ""
	} else {
		token = before
		rest = after
	}

	return
}

func consumeStructuredData(segment string) (structured string, rest string, err error) {
	if segment = strings.TrimLeft(segment, " "); segment == "" {
		err = fmt.Errorf("unexpected end of syslog header while parsing structured data")
		return
	}

	if segment[0] == '-' {
		structured = "-"
		rest = strings.TrimLeft(segment[1:], " ")
		return
	}

	if segment[0] != '[' {
		err = fmt.Errorf("malformed structured data: expected '[' or '-' at start")
		return
	}

	var (
		inQuotes bool
		depth    int
	)

	for i := range len(segment) {
		switch segment[i] {
		case '"':
			if i == 0 || segment[i-1] != '\\' {
				inQuotes = !inQuotes
			}
		case '[':
			if !inQuotes {
				depth++
			}
		case ']':
			if !inQuotes {
				depth--
				if depth == 0 {
					structured = segment[:i+1]
					rest = strings.TrimLeft(segment[i+1:], " ")
					return
				}
			}
		}
	}

	err = fmt.Errorf("malformed structured data: unmatched '['")
	return
}

func atoiDefault(s string, def int) (i int) {
	var err error
	if i, err = strconv.Atoi(s); err != nil {
		i = def
	}

	return
}

func timeStrToTime(s string) (t time.Time) {
	// This is a bit of a hack, but it should work for the expected format of the timestamp in the syslog messages.
	// The expected format is something like "2026-03-31T18:17:09-04:00", which is ISO 8601 with timezone offset.
	// Go's time package can parse this, but we need to convert it to a format it recognizes.

	// Replace the timezone offset colon with nothing, so it becomes "2026-03-31T18:17:09-0400"
	if len(s) > 6 && s[len(s)-6] == '-' && s[len(s)-3] == ':' {
		s = s[:len(s)-3] + s[len(s)-2:]
	} else if len(s) > 6 && s[len(s)-6] == '+' && s[len(s)-3] == ':' {
		s = s[:len(s)-3] + s[len(s)-2:]
	}

	// Now we can parse it using time.Parse with the appropriate layout.
	const layout = "2006-01-02T15:04:05-0700"
	var (
		err error
	)

	if t, err = time.Parse(layout, s); err != nil {
		t = time.Now() // Ideally get syslog events somewhat up to date
	}

	return
}

func splitCSVPreserveEmpty(s string) []string {
	return strings.Split(s, ",")
}

func parseIPv4Fields(entry *db.FirewallLogEntry, fields []string) (err error) {
	// After common prefix for IPv4, sample looks like:
	// 9: tos
	// 10: ecn
	// 11: ttl
	// 12: id
	// 13: offset
	// 14: flags
	// 15: protoid
	// 16: protoname
	// 17: length
	// 18: src ip
	// 19: dst ip

	if len(fields) < 20 {
		err = fmt.Errorf("not enough fields for IPv4 log entry")
		return
	}

	entry.ProtocolID = atoiDefault(fields[15], -1)
	entry.ProtocolText = fields[16]
	entry.Length = atoiDefault(fields[17], -1)
	entry.SrcIP = fields[18]
	entry.DstIP = fields[19]

	switch entry.ProtocolText {
	case "tcp":
		parseTCP(entry, fields, 20)
	case "udp":
		parseUDP(entry, fields, 20)
	default:
		parseGenericTail(entry, fields, 20)
	}

	return
}

func parseIPv6Fields(entry *db.FirewallLogEntry, fields []string) (err error) {
	// After common prefix for IPv6, sample looks like:
	// 9: class
	// 10: flowlabel
	// 11: hop limit
	// 12: protoname-ish / next header text
	// 13: protoid
	// 14: length
	// 15: src ip
	// 16: dst ip
	if len(fields) < 17 {
		return fmt.Errorf("ipv6 filterlog entry too short")
	}

	entry.ProtocolText = fields[12]
	entry.ProtocolID = atoiDefault(fields[13], 0)
	entry.Length = atoiDefault(fields[14], 0)
	entry.SrcIP = fields[15]
	entry.DstIP = fields[16]

	switch entry.ProtocolText {
	case "tcp":
		parseTCP(entry, fields, 17)
	case "udp":
		parseUDP(entry, fields, 17)
	case "icmp6", "ipv6-icmp":
		parseICMP(entry, fields, 17)
	default:
		parseGenericTail(entry, fields, 17)
	}

	return nil
}

func parseTCP(entry *db.FirewallLogEntry, fields []string, start int) {
	// Expected:
	// srcPort,dstPort,dataLen,tcpFlags,seq,ack,window,urg,options
	if len(fields) > start {
		entry.SrcPort = intPtr(atoiDefault(fields[start], 0))
	}

	if len(fields) > start+1 {
		entry.DstPort = intPtr(atoiDefault(fields[start+1], 0))
	}

	if len(fields) > start+3 {
		entry.TCPFlags = fields[start+3]
	}

	parseGenericTail(entry, fields, start+2)
}

func parseUDP(entry *db.FirewallLogEntry, fields []string, start int) {
	// Expected:
	// srcPort,dstPort,dataLen
	if len(fields) > start {
		entry.SrcPort = intPtr(atoiDefault(fields[start], 0))
	}

	if len(fields) > start+1 {
		entry.DstPort = intPtr(atoiDefault(fields[start+1], 0))
	}

	parseGenericTail(entry, fields, start+2)
}

func parseICMP(entry *db.FirewallLogEntry, fields []string, start int) {
	parseGenericTail(entry, fields, start)
}

func parseGenericTail(entry *db.FirewallLogEntry, fields []string, start int) {
	for i := start; i < len(fields); i++ {
		var v string = fields[i]
		if v == "" {
			continue
		}

		if strings.Contains(v, "=") {
			if k, val, ok := strings.Cut(v, "="); ok {
				entry.Extra[k] = val
				continue
			}
		}

		entry.Extra[fmt.Sprintf("field%d", i)] = v
	}
}

func intPtr(i int) *int {
	return &i
}
