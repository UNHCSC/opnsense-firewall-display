package db

import "time"

type (
	FirewallLogEntry struct {
		ID int `gomysql:"id,primary,increment" json:"id"`
		// Header
		HeaderPriority   int       `gomysql:"priority" json:"priority"`
		HeaderVersion    int       `gomysql:"version" json:"version"`
		HeaderTimestamp  time.Time `gomysql:"timestamp" json:"timestamp"`
		HeaderHostname   string    `gomysql:"hostname" json:"hostname"`
		HeaderAppName    string    `gomysql:"app_name" json:"app_name"`
		HeaderProcID     string    `gomysql:"proc_id" json:"proc_id"`
		HeaderMsgID      string    `gomysql:"msg_id" json:"msg_id"`
		HeaderStructured string    `gomysql:"structured_data" json:"structured_data"`
		// Body
		Rule         int               `gomysql:"rule" json:"rule"`
		SubRule      string            `gomysql:"sub_rule" json:"sub_rule"`
		Anchor       string            `gomysql:"anchor" json:"anchor"`
		Tracker      string            `gomysql:"tracker" json:"tracker"`
		Interface    string            `gomysql:"interface" json:"interface"`
		Reason       string            `gomysql:"reason" json:"reason"`
		Action       string            `gomysql:"action" json:"action"`
		Direction    string            `gomysql:"direction" json:"direction"`
		IPVersion    int               `gomysql:"ip_version" json:"ip_version"`
		ProtocolID   int               `gomysql:"protocol_id" json:"protocol_id"`
		ProtocolText string            `gomysql:"protocol_text" json:"protocol_text"`
		Length       int               `gomysql:"length" json:"length"`
		SrcIP        string            `gomysql:"src_ip" json:"src_ip"`
		DstIP        string            `gomysql:"dst_ip" json:"dst_ip"`
		SrcPort      *int              `gomysql:"src_port" json:"src_port,omitempty"`
		DstPort      *int              `gomysql:"dst_port" json:"dst_port,omitempty"`
		TCPFlags     string            `gomysql:"tcp_flags" json:"tcp_flags,omitempty"`
		Extra        map[string]string `gomysql:"extra" json:"extra,omitempty"`
		RawFilterLog string            `gomysql:"raw_filter_log" json:"raw_filter_log"`
	}
)
