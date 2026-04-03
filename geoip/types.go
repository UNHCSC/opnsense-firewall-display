package geoip

type (
	IPInfoASN struct {
		ASN          uint   `json:"asn"`
		Organization string `json:"organization"`
	}

	IPInfoCity struct {
		CountryISOCode string  `json:"country_iso_code"`
		CityName       string  `json:"city_name"`
		Latitude       float64 `json:"latitude"`
		Longitude      float64 `json:"longitude"`
	}

	IPInfoCountry struct {
		CountryName    string `json:"country_name"`
		CountryISOCode string `json:"country_iso_code"`
	}

	IPInfo struct {
		Address string        `json:"address"`
		ASN     IPInfoASN     `json:"asn"`
		City    IPInfoCity    `json:"city"`
		Country IPInfoCountry `json:"country"`
	}
)
