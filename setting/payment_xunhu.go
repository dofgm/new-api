package setting

var (
	XunhuEnabled     bool
	XunhuAppId       string
	XunhuAppSecret   string
	XunhuApiUrl      string = "https://api.xunhupay.com/payment/do.html"
	XunhuMinTopUp    int    = 1
	XunhuTestMode    bool   = false
	XunhuOrderExpire int    = 300
)
