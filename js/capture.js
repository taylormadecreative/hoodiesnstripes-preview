export function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s ?? '').trim());
}

export function tagsFor(source, ctx = {}) {
  switch (source) {
    case 'hero': return ['newsletter', 'drop:vanderbilt', 'source:hero'];
    case 'picker': return ['newsletter', `school:${ctx.school}`, 'source:picker'];
    case 'popup': return ['newsletter', ...(ctx.school ? [`school:${ctx.school}`] : []), 'source:popup'];
    case 'restock': return [`restock:${ctx.handle}`, 'source:restock'];
    case 'footer': return ['newsletter', ...(ctx.school ? [`school:${ctx.school}`] : []), 'source:footer'];
    case 'cover': return ['newsletter', 'source:cover'];
    case 'launch': return ['newsletter', 'drop:vanderbilt', `colorway:${ctx.colorway}`, 'source:product'];
    default: throw new Error(`unknown capture source: ${source}`);
  }
}

export function shouldShowPopup({ shown, dismissed, scrollRatio = 0, exitIntent = false }) {
  return !shown && !dismissed && (scrollRatio >= 0.5 || exitIntent);
}

export function wireForm(form, { onDone } = {}) {
  const input = form.querySelector('input[type="email"]');
  const status = form.querySelector('[data-status]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!isValidEmail(input.value)) {
      form.dataset.state = 'error';
      input.setAttribute('aria-invalid', 'true');
      status.textContent = 'That email doesn’t look right. Try again?';
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    const { source, handle, colorway } = form.dataset;
    const school = form.querySelector('select[name="school"]')?.value || form.querySelector('input[name="school"]:checked')?.value || form.dataset.school || '';
    form.dataset.tags = tagsFor(source, { school, handle, colorway }).join(',');
    form.dataset.state = 'done';
    status.textContent = `${form.dataset.success || 'You’re on the list.'} (Concept preview: no email was saved.)`;
    onDone?.(form);
  });
}
