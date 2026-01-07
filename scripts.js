let allData = [];
let viewer = null;

// Load data from root-level data.json
fetch("data.json")
    .then(response => {
        if (!response.ok) {
            throw new Error("Failed to load data.json");
        }
        return response.json();
    })
    .then(data => {
        allData = data;
        renderTable(allData.slice(0, 200)); // initial render
    })
    .catch(err => {
        console.error(err);
        alert("Could not load data.json");
    });

function applySearch() {
    const query = document.getElementById("searchBox").value.toLowerCase();

    const filtered = allData.filter(d =>
        d.gpcr.toLowerCase().includes(query) ||
        d.ligand.toLowerCase().includes(query)
    );

    renderTable(filtered.slice(0, 500));
}

function renderTable(data) {
    const tbody = document.querySelector("#resultsTable tbody");
    tbody.innerHTML = "";

    data.forEach(entry => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${entry.gpcr}</td>
            <td>${entry.ligand}</td>
            <td>${Number(entry.pKi).toFixed(2)}</td>
            <td>${Number(entry.score).toFixed(3)}</td>
            <td><button>View</button></td>
        `;

        row.querySelector("button").onclick = () => {
            loadStructure(entry.structure);
        };

        tbody.appendChild(row);
    });
}

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

// 3Dmol structure viewer
function loadStructure(pdbFile) {
    if (!viewer) {
        viewer = $3Dmol.createViewer("viewer", { backgroundColor: "white" });
    }

    viewer.clear();

    $.get(pdbFile, pdbData => {
        viewer.addModel(pdbData, "pdb");
        viewer.setStyle({}, { cartoon: { color: "spectrum" } });
        viewer.zoomTo();
        viewer.render();
    });
}
