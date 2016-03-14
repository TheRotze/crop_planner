# Stardew Valley Crop Planner

A tool for planning crop schedules in the Stardew Valley game.

<a href="http://exnil.github.io/crop_planner/">Live version on github.io</a>


## Crop Info
Profit per day is calculated using the minimum sale value of a single crop.

Profit per day: <code>((Total Harvests * Sale) - (Seed Price * Total Plantings)) / (Final Harvest Date - 1)</code>

### Example:
Parsnips take 4 days to grow after the day they are planted. In 28 days, they can be planted/harvested 6 times, assuming replanting occurs on the date of a harvest. The last harvest occurs on Day 25. Seeds cost 20g, and Parsnips sell for 35g.

<code>
((6 * 35g) - (20g * 6)) / (25 - 1)
90g / 24 = 3.75g/day
</code>
