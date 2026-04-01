package db

import "time"

// Note: Data is imported from FreeIPA and Proxmox. We do not create or destroy any of these
// referenced entities (Users, Groups, Assets), we only reference them and create mappings
// between them. We only care about what we import too. If a user imports the group "group1"
// and "user1" is a member of groups "group1" and "group2", we will only create the membership
// mapping between "user1" and "group1".

type (
	SyslogHeader struct {
		ID         int       `gomysql:"id,primary,increment" json:"id"`
		Priority   int       `gomysql:"priority" json:"priority"`
		Version    int       `gomysql:"version" json:"version"`
		Timestamp  time.Time `gomysql:"timestamp" json:"timestamp"`
		Hostname   string    `gomysql:"hostname" json:"hostname"`
		AppName    string    `gomysql:"app_name" json:"app_name"`
		ProcID     string    `gomysql:"proc_id" json:"proc_id"`
		MsgID      string    `gomysql:"msg_id" json:"msg_id"`
		Structured string    `gomysql:"structured_data" json:"structured_data"`
	}

	DBPointerInt struct {
		Value int `json:"value"`
	}

	FirewallLogEntry struct {
		ID             int               `gomysql:"id,primary,increment" json:"id"`
		SyslogHeaderID int               `gomysql:"syslog_header_id,fkey:SyslogHeader.id" json:"syslog_header_id"`
		Rule           int               `gomysql:"rule" json:"rule"`
		SubRule        string            `gomysql:"sub_rule" json:"sub_rule"`
		Anchor         string            `gomysql:"anchor" json:"anchor"`
		Tracker        string            `gomysql:"tracker" json:"tracker"`
		Interface      string            `gomysql:"interface" json:"interface"`
		Reason         string            `gomysql:"reason" json:"reason"`
		Action         string            `gomysql:"action" json:"action"`
		Direction      string            `gomysql:"direction" json:"direction"`
		IPVersion      int               `gomysql:"ip_version" json:"ip_version"`
		ProtocolID     int               `gomysql:"protocol_id" json:"protocol_id"`
		ProtocolText   string            `gomysql:"protocol_text" json:"protocol_text"`
		Length         int               `gomysql:"length" json:"length"`
		SrcIP          string            `gomysql:"src_ip" json:"src_ip"`
		DstIP          string            `gomysql:"dst_ip" json:"dst_ip"`
		SrcPort        *DBPointerInt     `gomysql:"src_port" json:"src_port,omitempty"`
		DstPort        *DBPointerInt     `gomysql:"dst_port" json:"dst_port,omitempty"`
		TCPFlags       string            `gomysql:"tcp_flags" json:"tcp_flags,omitempty"`
		Extra          map[string]string `gomysql:"extra" json:"extra,omitempty"`
		RawFilterLog   string            `gomysql:"raw_filter_log" json:"raw_filter_log"`
	}
)

// Note that full site administrators are configured through config.toml
// LDAP group entries. Usually defaults to "admins" for FreeIPA.
