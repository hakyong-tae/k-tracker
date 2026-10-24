import type { Ctx } from './_lib/env.ts';
import { html, page } from './_lib/html.ts';
import { pickLang } from './_lib/lang.ts';
import { t } from '../src/shared/i18n.ts';

export const onRequestGet = async (ctx: Ctx) => {
  const lang = pickLang(ctx.request);
  return page({
    lang, env: ctx.env, path: '/submit', scripts: ['submit'],
    title: `${t(lang, 'submitTitle')} · K-TRACKER`, description: t(lang, 'submitIntro'),
    body: html`<main class="wrap block"><h1>${t(lang, 'submitTitle')}</h1><p class="muted">${t(lang, 'submitIntro')}</p><div id="submit-app" data-lang="${lang}"></div></main>`,
  });
};
