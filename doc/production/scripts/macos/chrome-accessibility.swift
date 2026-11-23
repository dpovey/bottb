import AppKit
import ApplicationServices

guard let app = NSWorkspace.shared.runningApplications.first(where: {$0.bundleIdentifier == "com.google.Chrome"}) else {
    fatalError("Chrome not running")
}
let ax = AXUIElementCreateApplication(app.processIdentifier)
func read(_ element: AXUIElement, _ name: String) -> AnyObject? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else { return nil }
    return value
}
func str(_ element: AXUIElement, _ name: String) -> String {
    let value = read(element, name)
    return value as? String ?? (value as? URL)?.absoluteString ?? (value as? NSNumber)?.stringValue ?? ""
}
let shape = CommandLine.arguments
let manual = AXUIElementSetAttributeValue(ax, "AXManualAccessibility" as CFString, kCFBooleanTrue)
let wantedTitle = shape.count > 1 ? shape[1] : ""
let nativeWindows = read(ax,"AXWindows") as? [AXUIElement] ?? []
guard let root = nativeWindows.first(where: {str($0,"AXTitle").contains(wantedTitle)}) else {
    fatalError("Chrome has no matching window")
}
let title = str(root, "AXTitle")
guard title.contains(wantedTitle), title.contains("Google Chrome") else {
    fatalError("Unexpected focused Chrome window: \(title)")
}
let matches = shape.count > 2 ? Array(shape.dropFirst(2)) : []
var hits: [(AXUIElement, String)] = []
func walk(_ e: AXUIElement, _ depth: Int) {
    guard depth < 24 else { return }
    let role = str(e, "AXRole")
    let values = [str(e, "AXTitle"), str(e, "AXDescription"), str(e, "AXValue"), str(e, "AXHelp"), str(e, "AXURL")].filter { !$0.isEmpty }
    let label = values.joined(separator: " | ")
    if matches.isEmpty {
        if (role == "AXButton" || role == "AXTextArea" || role == "AXDialog" || role == "AXWebArea") && !label.isEmpty {
            print(role, label.prefix(130))
        }
    } else if matches.contains(where: { values.contains($0) || label.contains($0) }) {
        hits.append((e, role + " " + label))
    }
    for child in read(e, "AXChildren") as? [AXUIElement] ?? [] {
        walk(child, depth + 1)
    }
}
if matches.first == "--press" || matches.first == "--click" || matches.first == "--click-link" {
    walk(root, 0)
    let candidates = hits.filter { line in
        if matches.first == "--click-link", str(line.0, "AXRole") != "AXLink" { return false }
        let values = ["AXTitle", "AXDescription", "AXValue"].map { str(line.0, $0).trimmingCharacters(in: .whitespacesAndNewlines) }
        return matches.dropFirst().contains(where: { values.contains($0) }) && ["AXButton", "AXCheckBox", "AXTextArea", "AXTextField", "AXLink", "AXComboBox", "AXListBoxOption"].contains(str(line.0, "AXRole"))
    }
    guard candidates.count == 1 else { fatalError("Expected one button, found \(candidates.map{$0.1})") }
    if matches.first == "--click" || matches.first == "--click-link" {
        guard app.isActive else { fatalError("Chrome is not active") }
        var pos = CGPoint.zero
        var sz = CGSize.zero
        guard let posValue = read(candidates[0].0, "AXPosition"),
              let sizeValue = read(candidates[0].0, "AXSize"),
              AXValueGetValue(posValue as! AXValue, .cgPoint, &pos),
              AXValueGetValue(sizeValue as! AXValue, .cgSize, &sz),
              sz.width > 0, sz.height > 0 else { fatalError("No target position") }
        let pt = CGPoint(x: pos.x + sz.width / 2, y: pos.y + sz.height / 2)
        CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: pt, mouseButton: .left)?.post(tap: .cghidEventTap)
        CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: pt, mouseButton: .left)?.post(tap: .cghidEventTap)
        print(candidates[0].1, pt)
        exit(0)
    }
    let pressed = AXUIElementPerformAction(candidates[0].0, kAXPressAction as CFString)
    guard pressed == .success else { fatalError("AXPress failed \(pressed.rawValue)") }
    print(candidates[0].1)
} else {
    walk(root, 0)
    for (_, match) in hits { print(String(match.prefix(850))) }
}
