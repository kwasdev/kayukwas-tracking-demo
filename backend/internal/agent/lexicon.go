package agent

import "strings"

// DefectMapping maps local informal terms to technical defect standards
type DefectMapping struct {
	Code        string
	Name        string
	Action      string
	Severity    string // minor, major, critical
	Keywords    []string
}

// OperationMapping maps artisan terminology to production station
type OperationMapping struct {
	OperationName string
	StationCode   string
	StationSeq    int
	Keywords      []string
}

var WoodworkingOperations = []OperationMapping{
	{
		OperationName: "Wood Working (Serut, Potong, Bubut, Router)",
		StationCode:   "ST-1",
		StationSeq:    1,
		Keywords:      []string{"pasah", "serut", "ketam", "graji", "belah", "potong", "bubut", "tatah", "bobok", "router"},
	},
	{
		OperationName: "Pasca Wood Working (Amplas & Dempul)",
		StationCode:   "ST-2",
		StationSeq:    2,
		Keywords:      []string{"amplas", "sanding", "amplas halus", "amplas kasar", "dempul", "menambal", "filler", "grit"},
	},
	{
		OperationName: "Finishing (Celup Food-Grade Mineral Oil / Beeswax)",
		StationCode:   "ST-3",
		StationSeq:    3,
		Keywords:      []string{"celup", "nyirami", "oiling", "minyak", "beeswax", "mineral oil", "finishing", "poles"},
	},
	{
		OperationName: "Pasca Finishing (Laser Grafir & Final QC In-House)",
		StationCode:   "ST-4",
		StationSeq:    4,
		Keywords:      []string{"laser", "grafir", "logo", "buffing", "lap residu", "final qc", "inspeksi gerbang"},
	},
	{
		OperationName: "Packing & Barcode Pelabelan",
		StationCode:   "ST-5",
		StationSeq:    5,
		Keywords:      []string{"packing", "kemas", "bungkus", "barcode", "label", "kardus", "dus", "box", "shrink wrap"},
	},
}

var WoodDefectTaxonomy = []DefectMapping{
	{
		Code:     "DEF_CRACK_GRAIN",
		Name:     "Pecah Serat / Retak Rambut",
		Action:   "Reject (Scrap) atau Down-size",
		Severity: "major",
		Keywords: []string{"tugel", "pecah serat", "retak", "retak rambut", "patah", "belah"},
	},
	{
		Code:     "DEF_WARPING",
		Name:     "Kayu Melengkung / Muntir (Kadar Air Tinggi)",
		Action:   "Rework (Oven ulang / Planer)",
		Severity: "major",
		Keywords: []string{"muntir", "nglinting", "bengkok", "lengkung", "melengkung", "baling", "basah"},
	},
	{
		Code:     "DEF_KNOT_HOLE",
		Name:     "Mata Kayu Mati / Bolong Tembus",
		Action:   "Reject jika kontak makanan / Dempul pori",
		Severity: "major",
		Keywords: []string{"mata mati", "bolong", "mata kayu", "growong", "lubang"},
	},
	{
		Code:     "DEF_CHIPPED",
		Name:     "Gompal / Somplak Tepian",
		Action:   "Rework (Amplas ulang / Chamfering)",
		Severity: "minor",
		Keywords: []string{"gompal", "cuil", "somplak", "gowang", "coak", "gerigi"},
	},
	{
		Code:     "DEF_UNEVEN_FINISH",
		Name:     "Minyak Belang / Finishing Tidak Rata",
		Action:   "Rework (Lap kering & re-coating)",
		Severity: "minor",
		Keywords: []string{"mlocot", "belang", "ora rata", "botak", "kusam", "minyak ora rata", "minyak belang"},
	},
	{
		Code:     "DEF_MOLD",
		Name:     "Jamur / Kelembaban (Blue Stain)",
		Action:   "Reject Kritis (Oven Pengering Pabrik & Amplas Ulang)",
		Severity: "critical",
		Keywords: []string{"jamuren", "jamur", "lembab", "bulukan", "biru", "spora"},
	},
}

// FindDefectByText scans raw text and identifies mapped defect codes
func FindDefectByText(text string) []DefectMapping {
	lower := strings.ToLower(text)
	var found []DefectMapping
	for _, defect := range WoodDefectTaxonomy {
		for _, kw := range defect.Keywords {
			if strings.Contains(lower, kw) {
				found = append(found, defect)
				break
			}
		}
	}
	return found
}

// DetectStationByText matches text with probable workstation
func DetectStationByText(text string) *OperationMapping {
	lower := strings.ToLower(text)
	for _, op := range WoodworkingOperations {
		for _, kw := range op.Keywords {
			if strings.Contains(lower, kw) {
				return &op
			}
		}
	}
	return nil
}
