package app

import (
	"net/http"

	"github.com/UNHCSC/opnsense-firewall-display/client"
	"github.com/UNHCSC/opnsense-firewall-display/config"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/template/html/v2"
	"github.com/z46-dev/golog"
)

var appLog *golog.Logger = golog.New().Prefix("[Please call app.InitAndListen() with the main logger]", golog.BoldRed)

func InitAndListen(parentLog *golog.Logger) (app *fiber.App, err error) {
	appLog = parentLog.SpawnChild().Prefix("[APP]", golog.BoldPurple)

	var templateEngine *html.Engine

	if config.Config.WebServer.ReloadTemplatesOnEachRender {
		templateEngine = html.NewFileSystem(http.Dir("./client"), ".html")
	} else {
		templateEngine = html.NewFileSystem(http.FS(client.EmbedFS), ".html")
	}

	templateEngine.Reload(config.Config.WebServer.ReloadTemplatesOnEachRender)

	app = fiber.New(fiber.Config{
		Views:   templateEngine,
		Network: "tcp",
	})

	// Statics
	app.Static("/static", "./client/static", fiber.Static{
		CacheDuration: -1,
		MaxAge:        0,
		ModifyResponse: func(c *fiber.Ctx) error {
			c.Set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
			c.Set("Pragma", "no-cache")
			c.Set("Expires", "0")
			return nil
		},
	})

	// Pages
	app.Get("/manifest.webmanifest", func(c *fiber.Ctx) error {
		c.Set("Content-Type", "application/manifest+json; charset=utf-8")
		c.Set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
		return c.SendFile("./client/static/manifest.webmanifest", false)
	})
	app.Get("/service-worker.js", func(c *fiber.Ctx) error {
		c.Set("Content-Type", "application/javascript; charset=utf-8")
		c.Set("Service-Worker-Allowed", "/")
		c.Set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
		return c.SendFile("./client/static/service-worker.js", false)
	})
	app.Get("/app-icon.svg", func(c *fiber.Ctx) error {
		c.Set("Content-Type", "image/svg+xml; charset=utf-8")
		c.Set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
		return c.SendFile("./client/static/app-icon.svg", false)
	})
	app.Get("/app-icon-maskable.svg", func(c *fiber.Ctx) error {
		c.Set("Content-Type", "image/svg+xml; charset=utf-8")
		c.Set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
		return c.SendFile("./client/static/app-icon-maskable.svg", false)
	})
	app.Get("/", getIndex)

	// API
	var (
		api   fiber.Router = app.Group("/api")
		apiV1 fiber.Router = api.Group("/v1")
	)

	// API v1
	apiV1.Get("/logs", apiGetLogs)
	apiV1.Get("/logsByAge", apiGetLogsByAge)
	apiV1.Get("/logStream", apiGetLogStream)
	apiV1.Get("/geolocate", apiGetGeolocation)
	apiV1.Post("/geolocateMany", apiPostGeolocationMany)

	return
}
