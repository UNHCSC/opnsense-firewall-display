package config

type Configuration struct {
	WebServer struct {
		Address                     string   `toml:"address" default:":8080" validate:"required"`                     // Listen address for the web application server e.g. ":8080", "0.0.0.0:8080"
		TLSDir                      string   `toml:"tls_dir" default:""`                                              // Directory containing a crt and a key file for TLS. Leave empty to use HTTP instead of HTTPS.
		ReloadTemplatesOnEachRender bool     `toml:"reload_templates_on_each_render" default:"false"`                 // For development purposes. If true, templates are reloaded from disk on each render.
		RedirectServerAddresses     []string `toml:"redirect_server_addresses" default:"[]" validate:"dive,required"` // List of addresses ("host:port", or ":port") to which HTTP requests should be redirected to HTTPS. If your web app is on ":443", you might want to redirect ":80" here.
	} `toml:"web_server"` // Web server configuration

	Database struct {
		File string `toml:"file" default:"records.db" validate:"required"` // Path to the MySQL database file
	} `toml:"database"` // Database configuration

	SyslogListener struct {
		Address             string `toml:"address" default:":5140" validate:"required"` // Listen address for the syslog listener e.g. ":5140", "
		MaximumNumberToKeep int    `toml:"maximum_number_to_keep" default:"100000"`     // Maximum number of records to keep in the database. Older records will be deleted when this limit is exceeded.
	} `toml:"syslog_listener"` // Syslog listener configuration
}

var Config Configuration
