package main

import (
	"flag"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	var (
		listenAddr *string = flag.String("listen", ":5140", "UDP listen address")
		bufSize    *int    = flag.Int("bufsize", 64*1024, "receive buffer size in bytes")
	)

	flag.Parse()

	var (
		conn net.PacketConn
		err  error
	)

	if conn, err = net.ListenPacket("udp", *listenAddr); err != nil {
		log.Fatalf("failed to listen on %s: %v", *listenAddr, err)
	}

	defer conn.Close()

	log.Printf("syslog receiver listening on udp %s", *listenAddr)

	var (
		sigCh chan os.Signal = make(chan os.Signal, 1)
		buf   []byte         = make([]byte, *bufSize)
	)

	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigCh
		log.Println("shutting down")
		_ = conn.Close()
	}()

	for {
		var (
			n    int
			addr net.Addr
		)

		if n, addr, err = conn.ReadFrom(buf); err != nil {
			if opErr, ok := err.(*net.OpError); ok && !opErr.Timeout() {
				log.Printf("listener closed: %v", err)
				return
			}

			log.Printf("read error: %v", err)
			continue
		}

		var msg string = string(buf[:n])
		fmt.Printf("[%s] %s\n", addr.String(), msg)
	}
}
