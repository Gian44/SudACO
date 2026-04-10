import React from 'react';

export function DiagramCallout({ id, label, position, active, onActivate }) {
  return (
    <button
      type="button"
      className={`about-callout ${active ? 'is-active' : ''}`}
      style={{ top: position.top, left: position.left }}
      onMouseEnter={() => onActivate(id)}
      onFocus={() => onActivate(id)}
      onClick={() => onActivate(id)}
      aria-label={`Highlight ${label}`}
    >
      {id}
    </button>
  );
}

export function DiagramLegend({ items, activeId, onActivate }) {
  return (
    <ol className="about-legend-list">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className={`about-legend-item ${activeId === item.id ? 'is-active' : ''}`}
            onMouseEnter={() => onActivate(item.id)}
            onFocus={() => onActivate(item.id)}
            onClick={() => onActivate(item.id)}
          >
            <span className="about-legend-number">{item.id}</span>
            <span className="about-legend-text">
              <strong>{item.label}</strong>
              {item.description ? <em>{item.description}</em> : null}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function AboutDiagram({
  title,
  description,
  callouts,
  activeId,
  onActivate,
  showCanvasCallouts = true,
  children
}) {
  return (
    <section className="about-diagram">
      <header className="about-diagram-header">
        <h4>{title}</h4>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="about-diagram-content">
        <div className="about-diagram-canvas">
          {children}
          {showCanvasCallouts && callouts.map((callout) => (
            <DiagramCallout
              key={callout.id}
              id={callout.id}
              label={callout.label}
              position={callout.position}
              active={activeId === callout.id}
              onActivate={onActivate}
            />
          ))}
        </div>
        <DiagramLegend items={callouts} activeId={activeId} onActivate={onActivate} />
      </div>
    </section>
  );
}

export default AboutDiagram;
