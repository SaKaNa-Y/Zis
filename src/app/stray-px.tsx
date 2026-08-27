// DELIBERATE VIOLATION, removed in the commit after this one. ADR-0009 rests the
// absence of a text-size control on there being no px in type, spacing or the
// measure, so the scan that holds that up is proven rather than described.
export function StrayFromSrc() {
  return <p className="gap-[3px] text-[17px]">a spacing utility in pixels</p>
}
