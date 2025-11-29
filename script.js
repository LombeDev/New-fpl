let allData = [];
let index = 0;
const batchSize = 20;
let loading = false;

const container = document.getElementById("api-data");
const endMessage = document.getElementById("end-message");
const backToTop = document.getElementById("back-to-top");

// YOUR API URL — any public JSON API
const API_URL = "https://fantasy.premierleague.com/api/bootstrap-static/"; 

// Optional: Use a free CORS proxy if the API blocks browser requests
const proxy = "https://api.allorigins.win/raw?url="; 

fetch(proxy + encodeURIComponent(API_URL))
  .then(res => res.json())
  .then(data => {
    allData = data;
    renderBatch();
    window.addEventListener("scroll", handleScroll);
  })
  .catch(err => console.error("Error loading API:", err));

function renderBatch() {
  if (loading) return;
  loading = true;

  const end = index + batchSize;
  const slice = allData.slice(index, end);

  slice.forEach(row => {
    // Convert object into text for display
    const text = typeof row === "object"
      ? Object.entries(row).map(([k,v]) => `${k}: ${v}`).join(" | ")
      : row;

    const p = document.createElement("p");
    p.textContent = text;
    p.classList.add("fade-in");
    container.appendChild(p);
  });

  index = end;
  loading = false;

  if (index >= allData.length) {
    endMessage.style.display = "block";
  }
}

function handleScroll() {
  const scrollPosition = window.innerHeight + window.scrollY;
  const fullHeight = document.body.offsetHeight;

  // Infinite scroll
  if (scrollPosition >= fullHeight - 200 && index < allData.length) {
    renderBatch();
  }

  // Back to top button
  backToTop.style.display = window.scrollY > 300 ? "block" : "none";
}

backToTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});
