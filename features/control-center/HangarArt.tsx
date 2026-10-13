import type { SVGProps } from "react";

/** Original Minerva Mothership emblem. Decorative only; never replaces product labeling. */
export function AlienInsignia({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden="true" {...props}>
      <path d="M20 3.7C11.2 3.7 7 11.2 7.2 20.8c.2 7 6.3 13.3 12.8 15.6 6.5-2.3 12.6-8.6 12.8-15.6C33 11.2 28.8 3.7 20 3.7Z" fill="#533340" stroke="#DA8290" strokeWidth="1.6"/>
      <path d="M10 20.2c5.4-2.6 8.6.5 8.3 6.4-5.4.2-9.2-1.6-10-5.6m21.7-.8c-5.4-2.6-8.6.5-8.3 6.4 5.4.2 9.2-1.6 10-5.6" fill="#171320" stroke="#E6A1AD" strokeWidth=".9"/>
      <path d="M17.3 31.4c1.8 1.5 3.6 1.5 5.4 0M13 8.6C15 6.5 17.6 5.5 20 5.5" stroke="#EBB0BB" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
}

type CraftProps = {
  animate?: boolean;
  contacted?: boolean;
  onContact?: () => void;
};

/** Inline SVG intentionally keeps the craft sharp at browser zoom 50–150%. */
export function HangarCraft({ animate = true, contacted = false, onContact }: CraftProps) {
  return (
    <div className={"mothership-craft" + (!animate ? " is-still" : "") + (contacted ? " is-contacted" : "")}>
      <svg className="mothership-craft-svg" viewBox="0 0 510 328" role="img"
        aria-label="An alien spacecraft suspended above a small extraterrestrial silhouette, inside an orbital scanner">
        <defs>
          <radialGradient id="mship-halo"><stop stopColor="#B94A58" stopOpacity=".32"/><stop offset=".56" stopColor="#B94A58" stopOpacity=".07"/><stop offset="1" stopColor="#B94A58" stopOpacity="0"/></radialGradient>
          <linearGradient id="mship-craft-body" x1="0" x2=".2" y1="0" y2="1">
            <stop stopColor="#A76576"/><stop offset=".52" stopColor="#744355"/><stop offset="1" stopColor="#3E2938"/>
          </linearGradient>
          <linearGradient id="mship-dome" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#BA8793" stopOpacity=".8"/><stop offset="1" stopColor="#6A354A" stopOpacity=".28"/>
          </linearGradient>
          <linearGradient id="mship-beam" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#C6667B" stopOpacity=".34"/><stop offset="1" stopColor="#A34B62" stopOpacity="0"/>
          </linearGradient>
          <filter id="mship-glow"><feGaussianBlur stdDeviation="3"/></filter>
        </defs>

        <ellipse cx="298" cy="156" rx="175" ry="145" fill="url(#mship-halo)"/>
        <g className="mothership-orbit" fill="none" stroke="#956476" strokeWidth="1">
          <circle cx="298" cy="158" r="125" opacity=".25" strokeDasharray="3 7"/>
          <circle cx="298" cy="158" r="103" opacity=".21"/>
          <ellipse cx="298" cy="158" rx="149" ry="99" opacity=".23" strokeDasharray="2 7"/>
          <path d="M298 6v23M298 287v20M145 158h24M431 158h25" opacity=".55"/>
          <path d="M180 78a144 144 0 0 1 48-35M409 213a127 127 0 0 1-33 45" stroke="#D07483" strokeWidth="2" opacity=".64"/>
          <path d="M184 40l7 7m0-7-7 7m229 56 7 7m0-7-7 7M149 219l6 6m0-6-6 6" opacity=".6"/>
        </g>
        <g fill="#F5C3CC" opacity=".72">
          <circle cx="459" cy="82" r="1.7"/><circle cx="190" cy="18" r="1.2"/>
          <circle cx="128" cy="117" r="1.4"/><circle cx="459" cy="249" r="1"/>
          <circle cx="216" cy="277" r="1.1"/><circle cx="402" cy="24" r="1.3"/>
        </g>
        <path className="mothership-beam" d="M236 168H362L415 309H183Z" fill="url(#mship-beam)"/>
        <ellipse cx="298" cy="290" rx="91" ry="10" stroke="#BD7385" strokeWidth=".8" strokeDasharray="3 5" fill="none" opacity=".42"/>
        <g className="mothership-ufo">
          <ellipse cx="298" cy="148" rx="107" ry="31" fill="#B85F78" opacity=".31" filter="url(#mship-glow)"/>
          <path d="M243 139C246 103 268 79 298 79s52 24 55 60" fill="url(#mship-dome)" stroke="#CD8C9C" strokeWidth="1.8"/>
          <path d="M252 131c8-19 24-30 46-30s38 11 46 30" stroke="#F0B5C0" strokeOpacity=".38" fill="none" strokeWidth="1.1"/>
          <path d="M211 152c15-19 52-29 87-29s72 10 87 29l-12 27c-24 12-126 12-150 0Z"
            fill="url(#mship-craft-body)" stroke="#CB7C90" strokeWidth="1.9"/>
          <ellipse cx="298" cy="151" rx="111" ry="23" fill="#47303F" stroke="#E09AAB" strokeWidth="2.1"/>
          <ellipse cx="298" cy="149" rx="87" ry="11" stroke="#C88C9C" strokeWidth="1" fill="none" opacity=".67"/>
          <path d="M217 178c28 17 135 17 162 0" stroke="#B77486" strokeWidth="1.6" fill="none"/>
          <path d="M239 185l-13 9m131-9 14 9" stroke="#BA7B8E" strokeWidth="1" opacity=".48"/>
          {Array.from({ length: 7 }, (_, i) => (
            <circle key={i} cx={235 + i * 21} cy={162 + 6 * Math.sqrt(Math.max(0, 1 - Math.pow((235 + i * 21 - 298) / 100, 2)))}
              r="2.6" fill="#F0B0C0" className="mothership-porthole"/>
          ))}
        </g>
        <g className="mothership-visitor" transform="translate(298 263)">
          <ellipse cy="27" rx="39" ry="5.5" stroke="#AC667A" strokeDasharray="2 5" opacity=".5" />
          <path d="M-22 24c4-14 13-17 22-17s18 3 22 17" fill="#302330" stroke="#C38799" strokeWidth="1.2"/>
          <path d="M0-52c-15 0-22 12-21 29 1 13 10 26 21 27 11-1 20-14 21-27C22-40 15-52 0-52Z" fill="#513846" stroke="#DE9BAE" strokeWidth="1.5"/>
          <path d="M-19-25c7-3 13-1 14 8-8 1-13-1-16-6m40-2c-7-3-13-1-14 8 8 1 13-1 16-6" fill="#13111A" stroke="#E4A6B6" strokeWidth=".8"/>
          <path d="M-3-5h6" stroke="#E6A1B2" strokeWidth="1" strokeLinecap="round"/>
        </g>
        <g fontSize="9" fontFamily="monospace" letterSpacing="1.1" fill="#B88494">
          <text x="66" y="271">CRAFT 001</text><text x="66" y="286" fill="#957785">HOVER STABLE</text>
          <path d="M120 274h58" stroke="#966878" strokeWidth=".8" />
        </g>
      </svg>
      {onContact ? <button type="button" className="mothership-craft-hit" onClick={onContact}
        aria-label="Send a greeting to the alien spacecraft" title="Attempt first contact" /> : null}
      <div className="mothership-art-caption" aria-hidden="true">UNIDENTIFIED OBJECT // VERIFIED FRIENDLY</div>
    </div>
  );
}
