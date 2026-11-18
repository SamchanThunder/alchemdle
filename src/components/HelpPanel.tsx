export default function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="help">
      <h2 className="panel-title">How to Brew</h2>
      <p className="lede">
        Each day brings one target element, today’s brew. Combine the ingredients on your workbench to make it.
      </p>
      <ul className="rules">
        <li>
          <b>Drag</b> one ingredient onto another, or <b>tap</b> two in turn, to merge them. Both are used up and what
          they make appears in their place.
        </li>
        <li>
          <b>Ingredients</b> (the number on the brew card) are the items you start with. Each is a single copy. Some are
          red herrings you won’t need.
        </li>
        <li>
          <b>Par</b> is the fewest merges the brew can possibly be made in, like par in golf. Match it for the best
          title. Every extra merge counts against you.
        </li>
        <li>
          Pairs that <b>fizzle</b> (don’t react) cost nothing, so experiment freely.
        </li>
        <li>An element can react with itself, but only if you hold two copies.</li>
        <li>
          Painted into a corner? <b>Reset</b> brings back the starting ingredients. Your merge count carries on.
        </li>
        <li>A new brew bubbles up every day at local midnight. Past brews wait in the archive for practice.</li>
      </ul>
      <div className="panel-actions">
        <button className="btn btn-primary" onClick={onClose}>
          Light the cauldron
        </button>
      </div>

      <h3 className="panel-sub">Credits</h3>
      <ul className="credit-list">
        <li>
          Emoji designed by{" "}
          <a href="https://openmoji.org" target="_blank" rel="noreferrer">
            OpenMoji
          </a>
          , the open-source emoji and icon project. License:{" "}
          <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
            CC BY-SA 4.0
          </a>
          .
        </li>
        <li>
          Silhouette icons by Lorc, Delapouite and other contributors at{" "}
          <a href="https://game-icons.net" target="_blank" rel="noreferrer">
            game-icons.net
          </a>
          . License:{" "}
          <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">
            CC BY 3.0
          </a>
          . Changes: recoloured and given a drop shadow.
        </li>
        <li>
          Recipes adapted from a community-collected{" "}
          <a href="https://infinite-craft.com" target="_blank" rel="noreferrer">
            Infinite Craft
          </a>{" "}
          dataset (via vantezzen), plus some hand-written ones. Alchemdle is a fan project, not affiliated with Infinite
          Craft or Little Alchemy.
        </li>
      </ul>
    </div>
  );
}
