import type { Store } from './state';
import type { VenueData, Zone, Seat, Vec3 } from './types';
import { t, setLang, getLang } from './i18n';
import { distanceToStage, nearest } from './seat-info';

export interface UICallbacks {
  onZone(z: Zone): void;
  onEnterView(): void;
  onShare(): void;
  onLangChange(): void;
}

export function mountUI(root: HTMLElement, store: Store, venue: VenueData, stage: Vec3, cb: UICallbacks) {
  root.innerHTML = `
    <div id="top" style="position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:center;padding:12px 16px;color:#fff;background:linear-gradient(#000a,#0000)">
      <div id="title" style="font-weight:600"></div>
      <button id="lang" style="pointer-events:auto;border:1px solid #fff6;background:#0006;color:#fff;border-radius:8px;padding:6px 10px">EN</button>
    </div>
    <div id="zones" style="position:absolute;left:16px;bottom:56px;display:flex;gap:8px;flex-wrap:wrap"></div>
    <div id="card" style="position:absolute;right:16px;bottom:56px;max-width:280px;background:#111d;color:#fff;border-radius:14px;padding:14px;display:none"></div>
    <button id="back" style="position:absolute;left:16px;top:56px;display:none;pointer-events:auto;border:1px solid #fff6;background:#0006;color:#fff;border-radius:8px;padding:8px 12px"></button>
    <div id="foot" style="position:absolute;left:0;right:0;bottom:0;padding:6px 16px;font-size:11px;color:#fff9;background:#0008;text-align:center"></div>
  `;

  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;

  $('lang').onclick = () => {
    setLang(getLang() === 'th' ? 'en' : 'th');
    $('lang').textContent = getLang() === 'th' ? 'EN' : 'TH';
    cb.onLangChange();
    render();
  };
  $('back').onclick = () => {
    const s = store.get();
    if (s.view === 'pov') store.toSeat(s.seat!, s.zone!);
    else if (s.view === 'seat') store.toZone(s.zone!);
    else store.toOverview();
  };

  function renderZones() {
    const box = $('zones');
    box.innerHTML = '';
    box.style.display = store.get().view === 'overview' ? 'flex' : 'none';
    for (const z of venue.zones) {
      const b = document.createElement('button');
      const price = z.priceTHB ? `<span style="opacity:.85;font-weight:500"> · ฿${z.priceTHB.toLocaleString()}</span>` : '';
      b.innerHTML = `${z.name[getLang()]}${price}`;
      b.style.cssText = `pointer-events:auto;border:none;border-radius:10px;padding:7px 11px;color:#fff;font-size:12px;font-weight:700;background:${z.color};text-shadow:0 1px 2px #0007`;
      b.onclick = () => cb.onZone(z);
      box.appendChild(b);
    }
  }

  function renderCard() {
    const s = store.get();
    const card = $('card');
    if ((s.view === 'seat' || s.view === 'pov') && s.seat && s.zone) {
      const seat: Seat = s.seat;
      const d = distanceToStage(seat, stage).toFixed(0);
      const stair = nearest(seat.number, s.zone.seatRules.stairs);
      const exit = nearest(seat.number, s.zone.seatRules.exits);
      card.style.display = 'block';
      card.innerHTML = `
        <div style="font-size:15px;font-weight:700;margin-bottom:4px">${s.zone.name[getLang()]}</div>
        ${s.zone.priceTHB ? `<div style="color:#ffd479;font-size:13px;margin-bottom:6px">${t('price')}: ฿${s.zone.priceTHB.toLocaleString()}</div>` : ''}
        <div>${t('row')} ${seat.row} · ${t('seat')} ${seat.number}</div>
        <div style="color:#bbb;font-size:13px;margin-top:4px">${t('toStage')}: ${d} m</div>
        <div style="color:#bbb;font-size:13px">${t('nearestStair')}: ${stair ?? '-'} · ${t('nearestExit')}: ${exit ?? '-'}</div>
        <div style="display:flex;gap:8px;margin-top:10px">
          ${s.view === 'seat' ? `<button id="enter" style="pointer-events:auto;flex:1;border:none;border-radius:10px;padding:10px;background:#0071e3;color:#fff;font-weight:600">${t('enterView')}</button>` : ''}
          <a href="${s.zone.ticketUrl}" target="_blank" rel="noopener" style="flex:1;text-align:center;border-radius:10px;padding:10px;background:#34c759;color:#fff;font-weight:600;text-decoration:none">${t('getTickets')}</a>
        </div>
        <button id="share" style="pointer-events:auto;width:100%;margin-top:8px;border:1px solid #fff4;background:#0000;color:#fff;border-radius:10px;padding:8px">${t('share')}</button>
      `;
      const enter = card.querySelector<HTMLButtonElement>('#enter');
      if (enter) enter.onclick = cb.onEnterView;
      card.querySelector<HTMLButtonElement>('#share')!.onclick = cb.onShare;
    } else {
      card.style.display = 'none';
    }
  }

  function render() {
    const s = store.get();
    $('title').textContent = venue.venue.name[getLang()];
    $('back').style.display = s.view === 'overview' ? 'none' : 'block';
    $('back').textContent = t('back');
    $('foot').textContent = t('disclaimer');
    renderZones();
    renderCard();
  }

  store.subscribe(render);
  return { render };
}
