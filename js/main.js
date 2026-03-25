// js/main.js
document.addEventListener("DOMContentLoaded", () => {
  const targets = document.querySelectorAll(".js-fade-in");
  if (!("IntersectionObserver" in window) || targets.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target); // 一度表示したら監視終了
        }
      });
    },
    {
      threshold: 0.15, // 要素の15％くらい見えたら発火
    }
  );

  targets.forEach((el) => observer.observe(el));
});
