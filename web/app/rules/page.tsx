'use client';

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 md:p-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            📋 Task Tracker Rules & Guidelines
          </h1>

          {/* Weekly XP System */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-blue-600 dark:text-blue-400 mb-4 flex items-center gap-2">
              <span className="text-3xl">💯</span> Weekly XP System
            </h2>
            <div className="space-y-3 text-gray-700 dark:text-gray-300">
              <p className="text-lg">
                • Everyone starts with <span className="font-bold text-blue-600">100 XP</span> at the beginning of each week (Monday midnight)
              </p>
              <p className="text-lg">
                • XP resets every <span className="font-bold">Monday at 00:00</span> (Ethiopia Time, UTC+3)
              </p>
              <p className="text-lg">
                • Completing tasks does NOT give XP - it preserves your XP
              </p>
              <p className="text-lg">
                • Missing tasks causes you to LOSE XP
              </p>
            </div>
          </section>

          {/* Task Confirmation */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-green-600 dark:text-green-400 mb-4 flex items-center gap-2">
              <span className="text-3xl">✅</span> Task Confirmation
            </h2>
            <div className="space-y-3 text-gray-700 dark:text-gray-300">
              <p className="text-lg">
                • When it's time for a task, the bot sends a message asking: "Did you complete this task?"
              </p>
              <p className="text-lg">
                • Click <span className="font-bold text-green-600">✅ Yes</span> if you completed it - your XP is preserved
              </p>
              <p className="text-lg">
                • Click <span className="font-bold text-red-600">❌ No</span> if you didn't - you lose 10 XP immediately
              </p>
              <p className="text-lg">
                • Use <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">/markdone</span> to mark tasks as complete in advance (no confirmation needed)
              </p>
            </div>
          </section>

          {/* Deadlines */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-orange-600 dark:text-orange-400 mb-4 flex items-center gap-2">
              <span className="text-3xl">⏰</span> Task Deadlines
            </h2>
            <div className="space-y-3 text-gray-700 dark:text-gray-300">
              <p className="text-lg">
                • Tasks must be confirmed by <span className="font-bold">midnight of the next day</span>
              </p>
              <p className="text-lg">
                • Example: A task scheduled for Monday 8:00 AM must be confirmed before Tuesday 00:00
              </p>
              <p className="text-lg">
                • After midnight passes, confirmation buttons stop working
              </p>
              <p className="text-lg">
                • You cannot mark tasks as done after their deadline
              </p>
              <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                • If you don't confirm by midnight, the differential penalty system kicks in!
              </p>
            </div>
          </section>

          {/* Differential Penalty System - THE KEY RULE */}
          <section className="mb-10 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 p-6 rounded-xl border-2 border-red-300 dark:border-red-700">
            <h2 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
              <span className="text-3xl">⚖️</span> Differential Penalty System (IMPORTANT!)
            </h2>
            <div className="space-y-4 text-gray-800 dark:text-gray-200">
              <p className="text-lg font-bold text-red-700 dark:text-red-300">
                This is how the system keeps you both accountable!
              </p>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <h3 className="font-bold text-xl mb-3 text-gray-900 dark:text-white">How It Works:</h3>
                <ol className="space-y-3 list-decimal list-inside">
                  <li className="text-lg">At midnight, the system counts how many tasks each person missed (didn't confirm)</li>
                  <li className="text-lg">It calculates the <span className="font-bold">difference</span> in missed tasks</li>
                  <li className="text-lg">The person who missed <span className="font-bold text-red-600">MORE</span> tasks gets their XP set to: <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">lowest XP - (difference × 10)</span></li>
                  <li className="text-lg">The other person's XP stays unchanged</li>
                </ol>
              </div>

              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg mt-4">
                <h3 className="font-bold text-xl mb-3 text-gray-900 dark:text-white">Example Scenario:</h3>
                <div className="space-y-2 font-mono text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded">
                  <p>📊 Current Status:</p>
                  <p className="ml-4">• Person A: 80 XP</p>
                  <p className="ml-4">• Person B: 100 XP</p>
                  <p className="mt-3">📅 Day's Missed Tasks:</p>
                  <p className="ml-4">• Person A: 2 missed</p>
                  <p className="ml-4">• Person B: 3 missed</p>
                  <p className="mt-3">⚖️ Differential Calculation:</p>
                  <p className="ml-4">• Difference: 3 - 2 = 1 task</p>
                  <p className="ml-4">• Person B missed more (3 vs 2)</p>
                  <p className="ml-4">• Lowest current XP: 80 (Person A)</p>
                  <p className="ml-4">• New XP for Person B: 80 - (1 × 10) = 70</p>
                  <p className="mt-3">📊 Final Result:</p>
                  <p className="ml-4">• Person A: 80 XP (no change)</p>
                  <p className="ml-4 text-red-600 dark:text-red-400">• Person B: 100 → <span className="font-bold">70 XP</span></p>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg mt-4 border border-yellow-300 dark:border-yellow-700">
                <p className="text-lg font-bold text-yellow-800 dark:text-yellow-300">⚠️ Key Insight:</p>
                <p className="text-lg text-yellow-900 dark:text-yellow-200 mt-2">
                  The person who missed MORE tasks loses XP based on the lowest current XP. This means if you're behind and miss more, you get penalized relative to where the lowest person is, not from your own XP!
                </p>
              </div>

              <div className="mt-4">
                <h3 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">Special Cases:</h3>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                  <li>• If both miss equal tasks → No penalty for anyone</li>
                  <li>• If XP is tied → Person who missed more still gets penalized using the formula</li>
                  <li>• Penalty cannot take XP below 0 (minimum is 0 XP)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Manual "No" Penalty */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
              <span className="text-3xl">❌</span> Saying "No" to Task
            </h2>
            <div className="space-y-3 text-gray-700 dark:text-gray-300">
              <p className="text-lg">
                • When you click ❌ No, you lose <span className="font-bold text-red-600">10 XP immediately</span>
              </p>
              <p className="text-lg">
                • This is a direct penalty, not differential
              </p>
              <p className="text-lg">
                • Your streak for that task resets to 0
              </p>
              <p className="text-lg">
                • XP cannot go below 0
              </p>
            </div>
          </section>

          {/* Weekly Winner */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-purple-600 dark:text-purple-400 mb-4 flex items-center gap-2">
              <span className="text-3xl">🏆</span> Weekly Winner
            </h2>
            <div className="space-y-3 text-gray-700 dark:text-gray-300">
              <p className="text-lg">
                • At the end of the week (Monday 00:00), the person with <span className="font-bold text-purple-600">higher XP wins</span>
              </p>
              <p className="text-lg">
                • Winner levels up (+1 level)
              </p>
              <p className="text-lg">
                • Loser gets a random reward task from the winner
              </p>
              <p className="text-lg">
                • If tied (same XP) → Both level up, no reward task
              </p>
              <p className="text-lg">
                • If both have 100 XP (perfect week) → Both level up, no reward task
              </p>
            </div>
          </section>

          {/* Task Types */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-indigo-600 dark:text-indigo-400 mb-4 flex items-center gap-2">
              <span className="text-3xl">📅</span> Task Types
            </h2>
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">📅 Daily</h3>
                <p className="text-gray-700 dark:text-gray-300">Repeats every day at the same time. Must be confirmed before next midnight.</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">📆 Weekly</h3>
                <p className="text-gray-700 dark:text-gray-300">Repeats on specific days of the week. Only checked on those days.</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">🗓️ Custom</h3>
                <p className="text-gray-700 dark:text-gray-300">Choose your own specific days (e.g., Mon, Wed, Fri).</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">📌 One-time</h3>
                <p className="text-gray-700 dark:text-gray-300">Happens once on a specific date. After the date passes, cannot be marked done.</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">🔄 Flexible</h3>
                <p className="text-gray-700 dark:text-gray-300">No schedule, no deadlines. Complete whenever you want. Never causes penalties.</p>
              </div>
            </div>
          </section>

          {/* Tips for Success */}
          <section className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 p-6 rounded-xl">
            <h2 className="text-2xl font-semibold text-green-600 dark:text-green-400 mb-4 flex items-center gap-2">
              <span className="text-3xl">💡</span> Tips for Success
            </h2>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li className="text-lg">✨ Use <span className="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded">/markdone</span> to complete tasks early and skip confirmations</li>
              <li className="text-lg">🎯 Aim to confirm tasks on the same day to avoid midnight penalties</li>
              <li className="text-lg">📱 Keep notifications on to not miss task reminders</li>
              <li className="text-lg">🔥 Build streaks by completing tasks consistently</li>
              <li className="text-lg">⚖️ Remember: The differential penalty favors whoever is already winning!</li>
              <li className="text-lg">🏁 Start strong each week - early XP loss compounds with differential penalties</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
