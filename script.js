let allData = [];
let viewer = null;

// Load data
fetch("data/predictions.json")
    .then(response => response.json())
    .then(data => {
        allData = data;
        renderTable(allData.slice(0, 200)); // initial load
    });

function renderTable(data) {
    const tbody = document.querySelector("#resultsTable tbody");
    tbody.innerHTML = "";

    data.forEach(entry => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${entry.gpcr}</td>
            <td>${entry.ligand}</td>
            <td>${entry.pKi.toFixed(2)}</td>
            <td>${entry.score.toFixed(3)}</td>
            <td><button>View</button></td>
        `;

        row.querySelector("button").onclick = () => {
            loadStructure(entry.structure);
        };

        tbody.appendChild(row);
    });
}

// Search
document.getElementById("searchBox").addEventListener("input", e => {
    const query = e.target.value.toLowerCase();

    const filtered = allData.filter(d =>
        d.gpcr.toLowerCase().includes(query) ||
        d.ligand.toLowerCase().includes(query)
    );

    renderTable(filtered.slice(0, 500));
});

// 3D structure viewer
function loadStructure(pdbFile) {
    if (!viewer) {
        viewer = $3Dmol.createViewer("viewer", { backgroundColor: "white" });
    }

    viewer.clear();

    $.get(pdbFile, pdbData => {
        viewer.addModel(pdbData, "pdb");
        viewer.setStyle({}, { cartoon: { color: "spectrum" } });
        viewer.addSurface($3Dmol.SurfaceType.VDW, { opacity: 0.15 });
        viewer.zoomTo();
        viewer.render();
    });
}
