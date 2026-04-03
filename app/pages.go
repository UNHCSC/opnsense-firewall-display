package app

import (
	"time"

	"github.com/gofiber/fiber/v2"
)

func getIndex(c *fiber.Ctx) (err error) {
	err = c.Render("views/index", fiber.Map{
		"Title":         "OPNsense Firewall Visualizer",
		"Description":   "View semi-live logs from an OPNsense firewall in a clean and modern interface.",
		"CanonicalPath": "/",
		"BodyClass":     "index-page",
		"CurrentYear":   time.Now().Year(),
	}, "views/layout")

	return
}
