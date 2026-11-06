## Description

Provide a summary of the changes introduced in this pull request and the rationale behind them.

Closes #(issue)

---

## Type of Change

- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding musical capability or studio tool)
- [ ] New genre or style profile
- [ ] Documentation update
- [ ] Performance optimization / Audio rendering improvement

---

## Quality & Policy Checklist

- [ ] **Zero-Emoji Policy**: Verified that absolutely NO emojis are present in any code, comments, UI text, or commit messages.
- [ ] **Dark Studio Mode**: Verified that Dark Mode (#0F0E15) remains the primary, default aesthetic.
- [ ] **Vocal Disclaimer**: Maintained notice that this project generates musical arrangements and vocal lead sheets, not synthetic speech.
- [ ] **Automated Tests**: Ran `.venv/bin/python -m pytest tests/ -v` and verified that all unit and integration tests pass.
- [ ] **Type Safety**: Ran `npx tsc --noEmit` with zero errors.
- [ ] **Production Build**: Ran `npm run build` with clean bundling.
- [ ] **Security**: Verified no API keys, private tokens, or secrets are committed.
