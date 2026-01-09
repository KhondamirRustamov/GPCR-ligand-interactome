let allData = [];
let viewer = null;

// --------------------------
// Load data
// --------------------------
fetch("./data.json")
    .then(response => {
        if (!response.ok) throw new Error("Failed to load data.json");
        return response.json();
    })
    .then(data => {
        allData = data;
        populateGPCRDropdown(allData);
        renderTable(allData.slice(0, 200)); // initial display
    })
    .catch(err => {
        console.error(err);
        alert("Could not load data.json");
    });

// --------------------------
// Populate GPCR autocomplete dropdown
// --------------------------
function populateGPCRDropdown(data) {
    const datalist = document.getElementById("gpcrList");
    datalist.innerHTML = "";

    const gpcrs = [...new Set(data.map(d => d.gpcr))].sort();
    gpcrs.forEach(gpcr => {
        const option = document.createElement("option");
        option.value = gpcr;
        datalist.appendChild(option);
    });
}

// --------------------------
// Render table
// --------------------------
function renderTable(data) {
    const tbody = document.querySelector("#resultsTable tbody");
    tbody.innerHTML = "";

    data.forEach(entry => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${entry.gpcr}</td>
            <td>${entry.ligand}</td>
            <td>${Number(entry.affinity_mean).toFixed(3)}</td>
            <td>${Number(entry.confidence_score).toFixed(3)}</td>
            <td><button>View</button></td>
        `;

        // View button loads 3D structure
        row.querySelector("button").onclick = () => {
            loadStructure(entry.structure);
        };
        row.querySelector("button").onclick = () => {
            loadStructure(entry.structure);
        
            // filter to only this GPCR+ligand row
            const subset = allData.filter(d =>
                d.gpcr === entry.gpcr && d.ligand === entry.ligand
            );
        
            renderScoresTable(subset);
        };

        tbody.appendChild(row);
    });
}


// --------------------------
// Search functionality
// --------------------------
const searchBox = document.getElementById("searchBox");

// Live search while typing
searchBox.addEventListener("input", applySearch);

// Search when pressing Enter
searchBox.addEventListener("keydown", e => {
    if (e.key === "Enter") {
        e.preventDefault();
        applySearch();
    }
});

function applySearch() {
    const query = searchBox.value.toLowerCase();

    const filtered = allData.filter(d =>
        d.gpcr.toLowerCase().includes(query) ||
        d.ligand.toLowerCase().includes(query)
    );

    renderTable(filtered.slice(0, 500));
}

// --------------------------
// 3Dmol.js viewer for structures
// --------------------------
function loadStructure(pdbFile) {
    const viewerElement = document.getElementById("viewer");

    if (!viewer) {
        viewer = $3Dmol.createViewer(viewerElement, {
            backgroundColor: "white"
        });
    }

    viewer.clear();

    $.get(pdbFile, pdbData => {
        viewer.addModel(pdbData, "cif");

        // Protein cartoon, colored by B-factor
       // Remove waters
        viewer.setStyle({ resn: "HOH" }, {});

        // Ligands and non-protein atoms as sticks
        viewer.setStyle(
            { hetflag: true },
            {
                stick: { radius: 0.5 }
            }
        );
        viewer.setStyle(
            { hetflag: false },
            {   
                cartoon: {
                    colorscheme: {
                        prop: "b",
                        gradient: "roygb",
                        min: 50,
                        max: 100,
                    }
                }
            }
        );
        // Enable clicking
        viewer.setClickable({}, true, function(atom) {
            handleAtomClick(atom, viewer);
        });

        // enable double-click reset (SUPPORTED)
        const canvas = viewer.getCanvas();
        canvas.addEventListener("dblclick", function (e) {
            e.preventDefault();
            viewer.removeAllLabels();
            viewer.zoomTo();
            viewer.render();
        });
        
        viewer.zoomTo();
        viewer.render();
    });
}


function renderScoresTable(entries) {
    const tbody = document.querySelector("#scoresTable tbody");
    tbody.innerHTML = "";

    entries.forEach(entry => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${entry.gpcr}</td>
            <td>${entry.ligand}</td>
            <td>${entry.complex_plddt.toFixed(3)}</td>
            <td>${entry.complex_iplddt.toFixed(3)}</td>
            <td>${entry.iptm.toFixed(3)}</td>
            <td>${entry.complex_ipde.toFixed(3)}</td>
            <td>${entry.confidence_score.toFixed(3)}</td>
            <td>${entry.affinity_mean.toFixed(3)}</td>
        `;

        tbody.appendChild(row);
    });
}

function handleAtomClick(atom, viewer) {
    if (!atom) return;

    const resi = atom.resi;
    const chain = atom.chain;
    const resn = atom.resn;

    const cutoff = 5.0; // Å

    // Clear previous labels/styles
    viewer.removeAllLabels();

    // Reset base protein style
    viewer.setStyle(
        { hetflag: false },
        {
            cartoon: {
                colorscheme: {
                    prop: "b",
                    gradient: "roygb",
                    min: 100,
                    max: 50
                }
            }
        }
    );

    // Highlight clicked residue
    viewer.setStyle(
        { resi: resi, chain: chain },
        {
            stick: { radius: 0.4 },
            cartoon: { colorscheme: {
                    prop: "b",
                    gradient: "roygb",
                    min: 100,
                    max: 50
                } }
        }
    );

    // 🔹 Find nearby residues (distance-based)
    const nearbyAtoms = viewer.getModel().selectedAtoms({
        within: cutoff,
        sel: { resi: resi, chain: chain }
    });

    // Extract unique nearby residues
    const nearbyResidues = {};
    nearbyAtoms.forEach(a => {
        if (a.resi !== resi || a.chain !== chain) {
            nearbyResidues[`${a.chain}:${a.resi}`] = {
                resi: a.resi,
                chain: a.chain
            };
        }
    });

    // Highlight nearby residues
    Object.values(nearbyResidues).forEach(r => {
        viewer.setStyle(
            { resi: r.resi, chain: r.chain },
            {
                stick: { radius: 0.25 },
                cartoon: { colorscheme: {
                    prop: "b",
                    gradient: "roygb",
                    min: 100,
                    max: 50
                } }
            }
        );
    });

    // Add label for selected residue
    viewer.addLabel(
        `${resn} ${resi} (${chain})`,
        {
            position: atom,
            backgroundColor: "black",
            fontColor: "white",
            fontSize: 12,
            padding: 2
        }
    );

    // Zoom to neighborhood
    viewer.zoomTo({
        within: cutoff,
        sel: { resi: resi, chain: chain }
    });

    viewer.render();
}



