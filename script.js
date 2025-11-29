let allData = [];
let index = 0;
const batchSize = 20;
let loading = false;

const container = document.getElementById("sheet-data");
const endMessage = document.getElementById("end-message");
const backToTop = document.getElementById("back-to-top");

// Replace this with your Google Sheet API URL
const API_URL = "https://script.google.com/macros/s/AKfycbxR3uvGTqqydQYygcIfkUskXYfH5FStpy05d_q7EfQoKBuGhPDIU0SQin28eYaOhT46LQ/exec";

// Fetch data from Google Sheet API
fetch(API_URL)
  .then(res => res.json())
  .then(data => {
    allData = data;
    renderBatch();
    window.addEventListener("scroll", handleScroll);
  })
  .catch(err => console.error("Error:", err));

function renderBatch() {
  if (loading) return;
  loading = true;

  const end = index + batchSize;
  const slice = allData.slice(index, end);

  slice.forEach(row => {
    const text = Object.entries(row)
      .map(([key, value]) => `${key}: ${value}`)
      .join(" | ");

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
  if (window.scrollY > 300) {
    backToTop.style.display = "block";
  } else {
    backToTop.style.display = "none";
  }
}

// Back to top button click
backToTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});
