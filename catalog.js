// BuildFlow Construction Materials Catalog
const DEFAULT_CATALOG = [
  // Structural & Framing
  { id: "concrete_mix", name: "Concrete Mix (80lb bag)", category: "Structural", unit: "bags", basePrice: 7.50 },
  { id: "stud_2x4", name: "2x4 Lumber (8ft Stud)", category: "Structural", unit: "pieces", basePrice: 4.25 },
  { id: "stud_2x6", name: "2x6 Lumber (10ft Stud)", category: "Structural", unit: "pieces", basePrice: 8.50 },
  { id: "osb_plywood", name: "OSB Sheathing (4x8 Panel, 7/16\")", category: "Structural", unit: "sheets", basePrice: 16.80 },
  { id: "drywall_panel", name: "Drywall Panel (4x8, 1/2\")", category: "Structural", unit: "sheets", basePrice: 14.50 },
  { id: "rebar_steel", name: "Steel Rebar (1/2\" x 20ft)", category: "Structural", unit: "pieces", basePrice: 9.20 },
  { id: "galv_nails", name: "Galvanized Nails (5lb box)", category: "Structural", unit: "boxes", basePrice: 12.00 },
  { id: "wood_screws", name: "Wood Screws 3\" (100 pack)", category: "Structural", unit: "packs", basePrice: 8.50 },
  
  // Electrical & Wiring
  { id: "romex_12_2", name: "Romex 12/2 NM-B Wire (100ft)", category: "Electrical", unit: "rolls", basePrice: 78.00 },
  { id: "elec_box_1g", name: "Single-Gang Electrical Box", category: "Electrical", unit: "pieces", basePrice: 1.25 },
  { id: "circuit_breaker", name: "Double-Pole 20A Circuit Breaker", category: "Electrical", unit: "pieces", basePrice: 14.50 },
  { id: "outlet_duplex", name: "Standard Outlet (Duplex)", category: "Electrical", unit: "pieces", basePrice: 1.80 },
  { id: "pvc_conduit", name: "Conduit Pipe PVC (1/2\" x 10ft)", category: "Electrical", unit: "pieces", basePrice: 4.50 },
  
  // Plumbing & Piping
  { id: "pvc_pipe_2", name: "PVC Pipe (2\" x 10ft Schedule 40)", category: "Plumbing", unit: "pieces", basePrice: 11.20 },
  { id: "copper_pipe_half", name: "Copper Pipe (1/2\" x 10ft Type L)", category: "Plumbing", unit: "pieces", basePrice: 28.00 },
  { id: "ball_valv_3_4", name: "Brass Ball Valve (3/4\")", category: "Plumbing", unit: "pieces", basePrice: 12.50 },
  { id: "pex_tubing_red", name: "PEX Tubing (1/2\" x 100ft Red)", category: "Plumbing", unit: "rolls", basePrice: 36.00 },
  
  // Finishes & Interior
  { id: "ceramic_tiles", name: "Premium Ceramic Tiles (sq ft)", category: "Finishes", unit: "sq ft", basePrice: 4.50 },
  { id: "paint_interior", name: "Interior Latex Paint (1 Gal)", category: "Finishes", unit: "gallons", basePrice: 34.00 },
  { id: "paint_exterior", name: "Exterior Semi-Gloss Paint (1 Gal)", category: "Finishes", unit: "gallons", basePrice: 39.50 },
  { id: "hardwood_flooring", name: "Hardwood Oak Flooring (sq ft)", category: "Finishes", unit: "sq ft", basePrice: 6.80 },
  { id: "fiberglass_insul", name: "Fiberglass Insulation Batt (R-13)", category: "Finishes", unit: "bags", basePrice: 24.00 }
];

// Helper functions for products catalog
function getCatalog() {
  const local = localStorage.getItem("buildflow_custom_catalog");
  if (!local) {
    localStorage.setItem("buildflow_custom_catalog", JSON.stringify(DEFAULT_CATALOG));
    return DEFAULT_CATALOG;
  }
  return JSON.parse(local);
}

function saveCatalog(catalog) {
  localStorage.setItem("buildflow_custom_catalog", JSON.stringify(catalog));
}

function addCustomCatalogProduct(name, category, unit, basePrice) {
  const catalog = getCatalog();
  const id = "custom_" + Date.now();
  const newProduct = { id, name, category, unit, basePrice: parseFloat(basePrice) };
  catalog.push(newProduct);
  saveCatalog(catalog);
  return newProduct;
}
