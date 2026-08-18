// Used to report page-view analytics to the Base44 platform
// (base44.appLogs.logUserInApp) — removed along with the rest of the
// Base44 dependency, since that data was only viewable in Base44's own
// admin panel, which this project no longer has access to. App.jsx
// still renders <NavigationTracker /> as a no-op placeholder; kept as an
// empty component rather than removing the render call, to avoid an
// unrelated App.jsx diff for a component with no remaining purpose.
export default function NavigationTracker() {
    return null;
}