/* ─── SVG marker and filter definitions for OPD canvas ─── */

export function SvgDefs() {
  return (
    <defs>
      <pattern id="grid-dots" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="0.6" fill="rgba(0,0,0,0.06)" />
      </pattern>

      {/* Procedural transforming: filled arrowhead (consumption→, result→, effect↔) */}
      <marker id="arrow-proc" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,4 L0,8Z" fill="#16794a" />
      </marker>

      {/* Enabling: Agent = filled circle ● (ISO §8.1.1) */}
      <marker id="dot-agent" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto">
        <circle cx="5" cy="5" r="4" fill="#2b6cb0" />
      </marker>

      {/* Enabling: Instrument = hollow circle ○ (ISO §8.1.2) */}
      <marker id="circle-instrument" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto">
        <circle cx="5" cy="5" r="3.5" fill="white" stroke="#2b6cb0" strokeWidth="1.5" />
      </marker>

      {/* Structural: Aggregation = filled triangle ▲ (ISO §6) */}
      <marker id="triangle-filled" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
        <path d="M0,0 L12,6 L0,12Z" fill="#6b5fad" />
      </marker>

      {/* Structural: Exhibition = small filled triangle inside open triangle (ISO §6) */}
      <marker id="triangle-exhibit" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
        <path d="M0,0 L12,6 L0,12Z" fill="white" stroke="#6b5fad" strokeWidth="1.2" />
        <path d="M2,3.5 L7,6 L2,8.5Z" fill="#6b5fad" />
      </marker>

      {/* Structural: Generalization = open triangle △ (ISO §6) */}
      <marker id="triangle-open" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
        <path d="M0,0 L12,6 L0,12Z" fill="white" stroke="#6b5fad" strokeWidth="1.5" />
      </marker>

      {/* Structural: Classification = small filled circle inside open triangle (ISO §6) */}
      <marker id="triangle-classify" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
        <path d="M0,0 L12,6 L0,12Z" fill="white" stroke="#6b5fad" strokeWidth="1.5" />
        <circle cx="4" cy="6" r="2" fill="#6b5fad" />
      </marker>

      {/* Structural: Tagged = purple arrow (ISO §10.2) */}
      <marker id="arrow-tagged" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,4 L0,8Z" fill="#6b5fad" />
      </marker>

      {/* Control: invocation/exception = filled arrowhead */}
      <marker id="arrow-control" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,4 L0,8Z" fill="#c05621" />
      </marker>

      <filter id="glow-selected" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feFlood floodColor="#2b6cb0" floodOpacity="0.25" />
        <feComposite in2="blur" operator="in" />
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id="glow-drag" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="5" result="blur" />
        <feFlood floodColor="#2b6cb0" floodOpacity="0.35" />
        <feComposite in2="blur" operator="in" />
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id="glow-sim-active" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feFlood floodColor="#16794a" floodOpacity="0.3" />
        <feComposite in2="blur" operator="in" />
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id="glow-sim-waiting" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feFlood floodColor="#c05621" floodOpacity="0.25" />
        <feComposite in2="blur" operator="in" />
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}
