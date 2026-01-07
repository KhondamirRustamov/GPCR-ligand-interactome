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
                stick: { radius: 0.25 }
            }
        );
        viewer.setStyle(
            {
                cartoon: {
                    style: "trace",
                    colorscheme: {
                        prop: "b",
                        gradient: "roygb"
                    }
                }
            }
        );
        viewer.zoomTo();
        viewer.render();
    });
}
