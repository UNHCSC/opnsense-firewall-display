package listener

import (
	"net"

	"github.com/UNHCSC/opnsense-firewall-display/config"
	"github.com/z46-dev/golog"
)

var (
	logger        *golog.Logger
	pipeToProcess chan string = make(chan string, config.Config.SyslogListener.ChannelBufferSize)
)

func ListenForSyslogEvents(parentLogger *golog.Logger) (err error) {
	logger = parentLogger.SpawnChild().Prefix("[SYSLOG]", golog.BoldPurple)

	var conn net.PacketConn
	if conn, err = net.ListenPacket("udp", config.Config.SyslogListener.Address); err != nil {
		return
	}

	defer conn.Close()

	logger.Infof("syslog receiver listening on udp %s", config.Config.SyslogListener.Address)

	var buffer []byte = make([]byte, config.Config.SyslogListener.BufferSize)

	go syslogWorker()

	var n int

	for {
		if n, _, err = conn.ReadFrom(buffer); err != nil {
			logger.Errorf("syslog read error: %v", err)
			continue
		}

		// Put it into the channel, blocking only if it's full
		pipeToProcess <- string(buffer[:n])
	}
}
