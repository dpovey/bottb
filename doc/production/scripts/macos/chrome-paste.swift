import AppKit
import CoreGraphics
guard NSWorkspace.shared.frontmostApplication?.bundleIdentifier == "com.google.Chrome", CommandLine.arguments.count == 2 else {
    fatalError("Chrome must be focused, with one argument")
}
let p = NSPasteboard.general
let previous: [[(NSPasteboard.PasteboardType, Data)]] = (p.pasteboardItems ?? []).map { item in
    item.types.compactMap { t in item.data(forType: t).map { (t, $0) } }
}
p.clearContents()
guard p.setString(CommandLine.arguments[1], forType: .string) else { fatalError("pasteboard write failed") }
let ours = p.changeCount
for down in [true, false] {
    let key = CGEvent(keyboardEventSource: nil, virtualKey: 9, keyDown: down)
    key?.flags = .maskCommand
    key?.post(tap: .cghidEventTap)
}
Thread.sleep(forTimeInterval: 0.35)
if p.changeCount == ours {
    p.clearContents()
    let items = previous.map { data in
        let item = NSPasteboardItem()
        for (typ, bytes) in data { item.setData(bytes, forType: typ) }
        return item
    }
    if !items.isEmpty { p.writeObjects(items) }
}
