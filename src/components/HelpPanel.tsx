export default function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="help">
      <h2 className="panel-title">How to Brew</h2>
      <p className="lede">Combine ingredients to make today’s brew.</p>
      <ul className="rules">
        <li>
          <b>Drag</b> one ingredient onto another (or <b>tap</b> two) to merge them.
        </li>
        <li>
          Match the <b>Goal</b>, the fewest merges possible, for ★★★.
        </li>
        <li>Pairs that don’t react are free. Some ingredients are decoys.</li>
        <li>
          Stuck? <b>Reset</b> the board. Your merges still count.
        </li>
        <li>New brew every day at midnight.</li>
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
