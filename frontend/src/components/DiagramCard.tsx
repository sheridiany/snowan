import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { createStyles } from 'antd-style';

// The pre-built design system the model's SVG targets via class names (t/ts/th/box,
// c-{ramp}). A curated, warm-leaning ramp palette — [bg tint, stroke, ink] — with a
// dark variant, so a diagram stays seamless in both themes. This IS the polish: the
// model writes plain class names, the rendered look lives here.
const useStyles = createStyles(({ token, css, isDarkMode }) => {
  const LIGHT: Record<string, [string, string, string]> = {
    blue: ['#eaf0fb', '#6f9be0', '#345b9e'],
    teal: ['#e3f4f0', '#46b1a1', '#1f7d6e'],
    amber: ['#fcefda', '#d99b3e', '#9a6a14'],
    green: ['#e9f4e6', '#6db368', '#3a7d36'],
    red: ['#fbeae7', '#d97b6f', '#a44034'],
    purple: ['#f0eafb', '#9a7fd4', '#6043a0'],
    coral: ['#fcebe3', '#df8466', '#a8512f'],
    pink: ['#fbe9f1', '#d878a6', '#a23a6b'],
    gray: ['#eef0f2', '#aab2bb', '#5b6570'],
  };
  const DARK: Record<string, [string, string, string]> = {
    blue: ['#1b2640', '#5e86c9', '#aecbf5'],
    teal: ['#15302c', '#46a899', '#8fe0d2'],
    amber: ['#352a18', '#c98f3c', '#f0c889'],
    green: ['#1c2c1b', '#5fa85a', '#a9dba4'],
    red: ['#361f1c', '#c87568', '#f0a99e'],
    purple: ['#271f38', '#8e74c9', '#c6b2f0'],
    coral: ['#34221b', '#cf7f5f', '#f0b59a'],
    pink: ['#341b28', '#cf76a0', '#f0a9c8'],
    gray: ['#2a2f36', '#5a636e', '#aab2bb'],
  };
  const P = isDarkMode ? DARK : LIGHT;
  const ramps = Object.keys(P)
    .map((k) => {
      const [bg, stroke, ink] = P[k];
      return `
      & .c-${k} > rect, & .c-${k} > circle, & .c-${k} > ellipse, & .c-${k} > polygon {
        fill: ${bg}; stroke: ${stroke}; stroke-width: 0.5;
      }
      & .c-${k} .t, & .c-${k} .th { fill: ${ink}; }
      & .c-${k} .ts { fill: ${ink}; opacity: 0.78; }`;
    })
    .join('\n');

  return {
    card: css`
      align-self: stretch;
      width: 100%;
      border: 1px solid ${token.colorBorderSecondary};
      border-radius: ${token.borderRadiusLG}px;
      background: ${token.colorBgContainer};
      padding: 14px 16px;
      overflow: hidden;
    `,
    title: css`
      font-size: 12.5px;
      font-weight: 600;
      letter-spacing: 0.01em;
      color: ${token.colorTextSecondary};
      margin-bottom: 10px;
    `,
    body: css`
      --p: ${token.colorText};
      --s: ${token.colorTextSecondary};
      --t: ${token.colorTextTertiary};
      --bg2: ${token.colorFillSecondary};
      --b: ${token.colorBorderSecondary};
      & svg {
        display: block;
        width: 100%;
        height: auto;
      }
      & text {
        font-family: ${token.fontFamily};
      }
      & .t {
        font-size: 14px;
        font-weight: 400;
        fill: var(--p);
      }
      & .th {
        font-size: 14px;
        font-weight: 500;
        fill: var(--p);
      }
      & .ts {
        font-size: 12px;
        font-weight: 400;
        fill: var(--s);
      }
      & .box {
        fill: var(--bg2);
        stroke: var(--b);
        stroke-width: 0.5;
      }
      & .arr {
        fill: none;
        stroke: var(--s);
        stroke-width: 1.5;
      }
      & .leader {
        fill: none;
        stroke: var(--t);
        stroke-width: 0.5;
        stroke-dasharray: 2 3;
      }
      & .node {
        cursor: default;
      }
      ${ramps}
    `,
  };
});

// The model emits a raw <svg> via render_diagram; we sanitize it (strip scripts /
// event handlers — it's model output rendered in the user's app) and render inline so
// the design-system CSS above themes it.
export default function DiagramCard({ svg, title }: { svg: string; title?: string }) {
  const { styles } = useStyles();
  const clean = useMemo(
    () => DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } }),
    [svg],
  );
  return (
    <div className={styles.card} role="img" aria-label={title || '图示'}>
      {title && <div className={styles.title}>{title}</div>}
      <div className={styles.body} dangerouslySetInnerHTML={{ __html: clean }} />
    </div>
  );
}
