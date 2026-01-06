// Visibility Observer for Demo Section

let isDemoVisible = false;

export function getIsDemoVisible(): boolean {
  return isDemoVisible;
}

export function initVisibilityObserver(): void {
  const demoSection = document.getElementById("restore");
  if (!demoSection) return;

  const observer = new IntersectionObserver(
    (entries) => {
      isDemoVisible = entries[0].isIntersecting;
    },
    { threshold: 0.2 }, // 20% visible triggers
  );

  observer.observe(demoSection);
}
