# Project output colour space for RCM: "dwg" = DaVinci WG / DaVinci Intermediate (timeline space, for DWG/DI measurement
# renders and RiP), "709" = Rec.709 / Gamma 2.4 (delivery). Read back. Usage: rr.sh resolve/output_space.py dwg|709
import sys, DaVinciResolveScript as d
p = d.scriptapp("Resolve").GetProjectManager().GetCurrentProject()
cs, g = {"dwg": ("DaVinci WG", "DaVinci Intermediate"), "709": ("Rec.709", "Gamma 2.4")}[sys.argv[1]]
rd = lambda: (p.GetSetting("colorSpaceOutput"), p.GetSetting("colorSpaceOutputGamma"))
print("before", rd(), "set", p.SetSetting("colorSpaceOutput", cs), p.SetSetting("colorSpaceOutputGamma", g), "after", rd())
