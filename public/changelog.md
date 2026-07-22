# Update [2026-07-23]
- Fixed chat not working on mobile: virtual keyboard Enter key is now correctly detected, autocorrect/autocapitalize disabled on chat input
- Added a **Send** button that appears below the chat box on mobile so messages can be submitted by tap
- Fixed bug where chat dismiss code referenced the container div instead of the input element
- Fixed class tree on mobile: tapping **✕ (close)**, **+ (zoom in)**, and **− (zoom out)** buttons now works via touch
- Fixed class tree drag on mobile: touching and dragging the tree now pans it with momentum (same as mouse)
- Added native search overlay for the class tree on mobile: tapping the search bar opens a proper text input field
- Added automated tank tier system: tiers are computed from branching depth (Tier 4 = leaf, Tier 3 branches to Tier 4, Tier 2 to Tier 3, Tier 1 to Tier 2)
- Class tree now orders tanks by tier left-to-right (lower tier = more branching potential = appears first)
- Upgrade buttons now ordered by tier: Tier 1 upgrades appear before Tier 2, Tier 3, and Tier 4

# Update [2026-07-22]
- Fixed decorative barrels/trapezoids on tanks like Assassin and Single incorrectly triggering recoil/shooting animations
- Updated tank upgrade trees so all tanks (including Healer, Flail, Single) branch from Basic
- Implemented Operator role hierarchy (Arena Operator, Admin Staff, Admin Candidate) with promotion/demotion permissions
- Added <b>+U</b> chat command to broadcast online player roles with [P], [C], [S], [O] tags

# Update [2026-07-22]
- Reworked Eternal boss: <b>Kratos</b> (yellow/neutral, 11-gon trap → 9-gon auto-4 missile launcher → 7-gon twindertow → 5-gon iterator, size 95)
- Reworked Celestial boss: <b>Themis</b> (wine-dark, 9-gon trap → 7-gon undertow → 5-gon annihilator)
- Reworked Rogue Eternal boss: <b>Ouranous</b> (darkGrey, 11-gon mech → 9-gon wrench → 7-gon underseer → 5-gon sidewinder, size 85)
- Added new <b>underseerTurret</b> (drone spawner turret for Ouranous)
- <b>$egg</b> command spawns rogue eggs: palisade, armada, julius, genghis, napoleon, ouranous

# Update [2026-07-22]
- Renamed game branding to <b>2-arras</b>
- Updated primary theme accent color to purple (#9966ff) and secondary to cyan (#66ebff)
- Restored missing tanks to the Misc menu (The Amalgamation, The Conglomerate, School Shooter, Average 4TDM Score, Average L-39 Hunt, Quad Cyclone, Beeman)
- Added custom facial expressions to DigDig menu tanks (Normal & Charlie Kirk caricatures)
- Updated social buttons (Discord, Patreon, GitHub)

# Update [2026-07-21]
- Game wipe from GitHub