import AppIntents
import Foundation
import UIKit

// Siri and Shortcuts for SIDLNE. The web app saves a small summary of the next
// two weeks (Preferences plugin, key "sidlne-siri") every time it refreshes, and
// these intents read it, so Siri can answer without opening the app.

struct SiriSnapshot: Decodable {
    struct Event: Decodable {
        let title: String
        let start: Date
        let athlete: String?
        let location: String?
        let driver: String?
        let directionsUrl: String?
        let mixUrl: String?
    }

    let events: [Event]
    let mixUrl: String?

    static func load() -> SiriSnapshot? {
        guard let text = UserDefaults.standard.string(forKey: "CapacitorStorage.sidlne-siri"),
              let data = text.data(using: .utf8) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let value = try decoder.singleValueContainer().decode(String.self)
            let iso = ISO8601DateFormatter()
            iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = iso.date(from: value) { return date }
            iso.formatOptions = [.withInternetDateTime]
            if let date = iso.date(from: value) { return date }
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Bad date \(value)"))
        }
        return try? decoder.decode(SiriSnapshot.self, from: data)
    }

    // Events that haven't started yet (or started in the last 15 minutes)
    var upcoming: [Event] {
        let cutoff = Date().addingTimeInterval(-15 * 60)
        return events.filter { $0.start >= cutoff }.sorted { $0.start < $1.start }
    }
}

enum SiriText {
    static let notSetUp = "Open SIDLNE once so I can see your family's schedule."

    // "today at 5:00 PM", "tomorrow at 9:30 AM", "Thursday at 5:00 PM", "Oct 22 at 5:00 PM"
    static func when(_ date: Date) -> String {
        let cal = Calendar.current
        let time = DateFormatter.localizedString(from: date, dateStyle: .none, timeStyle: .short)
        if cal.isDateInToday(date) { return "today at \(time)" }
        if cal.isDateInTomorrow(date) { return "tomorrow at \(time)" }
        let days = cal.dateComponents([.day], from: cal.startOfDay(for: Date()), to: cal.startOfDay(for: date)).day ?? 99
        let f = DateFormatter()
        f.setLocalizedDateFormatFromTemplate(days < 7 ? "EEEE" : "MMMd")
        return "\(f.string(from: date)) at \(time)"
    }

    static func what(_ e: SiriSnapshot.Event) -> String {
        if let who = e.athlete, !who.isEmpty { return "\(who)'s \(e.title)" }
        return e.title
    }
}

@available(iOS 16.0, *)
struct NextEventIntent: AppIntent {
    static var title: LocalizedStringResource = "What's next"
    static var description = IntentDescription("Hear your family's next game or practice.")

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snap = SiriSnapshot.load() else { return .result(dialog: IntentDialog(stringLiteral: SiriText.notSetUp)) }
        guard let e = snap.upcoming.first else {
            return .result(dialog: "Nothing on the calendar for the next two weeks. Enjoy the break!")
        }
        var line = "Next up: \(SiriText.what(e)), \(SiriText.when(e.start))"
        if let place = e.location, !place.isEmpty { line += " at \(place)" }
        line += "."
        if let driver = e.driver, !driver.isEmpty { line += " \(driver) is driving." } else { line += " Nobody is driving yet." }
        return .result(dialog: IntentDialog(stringLiteral: line))
    }
}

@available(iOS 16.0, *)
struct WhoIsDrivingIntent: AppIntent {
    static var title: LocalizedStringResource = "Who's driving"
    static var description = IntentDescription("Find out who's driving to the next game.")

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snap = SiriSnapshot.load() else { return .result(dialog: IntentDialog(stringLiteral: SiriText.notSetUp)) }
        guard let e = snap.upcoming.first else { return .result(dialog: "There's nothing to drive to in the next two weeks.") }
        let line: String
        if let driver = e.driver, !driver.isEmpty {
            line = "\(driver) is driving to \(SiriText.what(e)), \(SiriText.when(e.start))."
        } else {
            line = "Nobody is driving to \(SiriText.what(e)) \(SiriText.when(e.start)) yet. Open SIDLNE to claim it."
        }
        return .result(dialog: IntentDialog(stringLiteral: line))
    }
}

@available(iOS 16.0, *)
struct WeekScheduleIntent: AppIntent {
    static var title: LocalizedStringResource = "This week's schedule"
    static var description = IntentDescription("Hear what's coming up in the next 7 days.")

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snap = SiriSnapshot.load() else { return .result(dialog: IntentDialog(stringLiteral: SiriText.notSetUp)) }
        let week = snap.upcoming.filter { $0.start < Date().addingTimeInterval(7 * 86400) }
        if week.isEmpty { return .result(dialog: "Nothing on the calendar this week.") }
        var line = week.count == 1 ? "One event this week: " : "\(week.count) events this week. "
        line += week.prefix(3).map { "\(SiriText.what($0)) \(SiriText.when($0.start))" }.joined(separator: "; ")
        if week.count > 3 { line += "; and \(week.count - 3) more" }
        line += "."
        return .result(dialog: IntentDialog(stringLiteral: line))
    }
}

@available(iOS 16.0, *)
struct GameDayMixIntent: AppIntent {
    static var title: LocalizedStringResource = "Play the Game Day mix"
    static var description = IntentDescription("Start your pump-up playlist for the drive to the game.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let snap = SiriSnapshot.load()
        let link = snap?.upcoming.first?.mixUrl ?? snap?.mixUrl
            ?? "https://open.spotify.com/search/pump%20up%20clean"
        if let url = URL(string: link) { await UIApplication.shared.open(url) }
        return .result(dialog: "Let's go! Playing your Game Day mix.")
    }
}

@available(iOS 16.0, *)
struct DirectionsIntent: AppIntent {
    static var title: LocalizedStringResource = "Directions to the next game"
    static var description = IntentDescription("Get directions to your next game or practice.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snap = SiriSnapshot.load() else { return .result(dialog: IntentDialog(stringLiteral: SiriText.notSetUp)) }
        guard let e = snap.upcoming.first(where: { ($0.directionsUrl ?? "").isEmpty == false }),
              let url = URL(string: e.directionsUrl!) else {
            return .result(dialog: "Your next event doesn't have a location yet.")
        }
        await UIApplication.shared.open(url)
        return .result(dialog: IntentDialog(stringLiteral: "Heading to \(SiriText.what(e))."))
    }
}

@available(iOS 16.0, *)
struct SIDLNEShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: NextEventIntent(),
            phrases: [
                "What's next on \(.applicationName)",
                "What's next in \(.applicationName)",
                "When's the next game on \(.applicationName)",
                "Check \(.applicationName)",
            ],
            shortTitle: "What's next",
            systemImageName: "sportscourt"
        )
        AppShortcut(
            intent: WhoIsDrivingIntent(),
            phrases: [
                "Who's driving on \(.applicationName)",
                "Who's driving in \(.applicationName)",
                "Who's driving to the game on \(.applicationName)",
            ],
            shortTitle: "Who's driving",
            systemImageName: "car"
        )
        AppShortcut(
            intent: WeekScheduleIntent(),
            phrases: [
                "What's on this week in \(.applicationName)",
                "What's on this week on \(.applicationName)",
                "This week on \(.applicationName)",
            ],
            shortTitle: "This week",
            systemImageName: "calendar"
        )
        AppShortcut(
            intent: GameDayMixIntent(),
            phrases: [
                "Play the Game Day mix on \(.applicationName)",
                "Play the Game Day mix in \(.applicationName)",
                "Pump us up with \(.applicationName)",
                "Game day with \(.applicationName)",
            ],
            shortTitle: "Game Day mix",
            systemImageName: "music.note"
        )
        AppShortcut(
            intent: DirectionsIntent(),
            phrases: [
                "Take me to the game with \(.applicationName)",
                "Directions to the game on \(.applicationName)",
                "Directions with \(.applicationName)",
            ],
            shortTitle: "Directions",
            systemImageName: "location"
        )
    }
}
