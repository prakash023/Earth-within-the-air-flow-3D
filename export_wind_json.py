import xarray as xr
import json
import numpy as np

# load your ECMWF / oper file
path = r"data_stream-oper_stepType-instant.nc"
ds = xr.open_dataset(path)

print("✅ vars:", list(ds.data_vars))
print("✅ dims:", list(ds.dims))

time_dim = "valid_time" if "valid_time" in ds.dims else "time"
u_var = [v for v in ds.data_vars if "u" in v.lower()][0]
v_var = [v for v in ds.data_vars if "v" in v.lower()][0]

u = ds[u_var].isel({time_dim: 0})
v = ds[v_var].isel({time_dim: 0})

lats = ds["latitude"].values
lons = ds["longitude"].values

# flip latitude if descending
if lats[0] > lats[-1]:
    lats = lats[::-1]
    u = u[::-1, :]
    v = v[::-1, :]

u_np = np.nan_to_num(u.values, nan=0.0)
v_np = np.nan_to_num(v.values, nan=0.0)

# a gentle scale so motion is visible in the browser
scale_factor = 2.0
u_scaled = (u_np * scale_factor).astype(np.float32)
v_scaled = (v_np * scale_factor).astype(np.float32)

out = {
    "width": int(u_scaled.shape[1]),   # lon
    "height": int(u_scaled.shape[0]),  # lat
    "u": u_scaled.flatten().tolist(),
    "v": v_scaled.flatten().tolist(),
    "uMin": float(u_scaled.min()),
    "uMax": float(u_scaled.max()),
    "vMin": float(v_scaled.min()),
    "vMax": float(v_scaled.max()),
    "lon0": float(lons.min()),
    "lon1": float(lons.max()),
    "lat0": float(lats.min()),
    "lat1": float(lats.max()),
    "grid": 0.25  # assumption based on your file
}

with open("berlin_wind.json", "w", encoding="utf-8") as f:
    json.dump(out, f, separators=(",", ":"))

print("🎉 berlin_wind.json written")
print("shape:", out["height"], "x", out["width"])
