(function() {
  const target = window.location.hostname;
  fetch(`/api/v1/trust?target=${target}`)
    .then(r => r.json())
    .then(data => {
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#111; color:white; padding:8px 16px; border-radius:40px; font-family:system-ui; z-index:10000';
      div.innerHTML = `<a href="/verify/${target}" style="color:white; text-decoration:none;">🔒 LOGEN Trust: ${data.score}/100</a>`;
      document.body.appendChild(div);
    });
})(); 