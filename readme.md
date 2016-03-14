# Stardew Valley Crop Planner

A tool for planning crop schedules in the Stardew Valley game.

<a href="http://exnil.github.io/crop_planner/">Live version on github.io</a>


## Crop Info
Profit per day is calculated using the minimum sale value of a single crop.<br>
Profit per day: <code>((Total Harvests * Sells For) - (Seed Price * Total Plantings)) / (Final Harvest Date - 1)</code>

<b>Example 1:</b><br>
Parsnips take 4 days to grow after the day they are planted. In Spring, they can be planted/harvested 6 times, assuming replanting occurs on the date of a harvest. The last harvest occurs on Day 25. Seeds cost 20g, and Parsnips sell for 35g.
<pre>
((6 * 35g) - (20g * 6)) / (25 - 1)
90g / 24
<b>= 3.75g/day</b>
</pre>


<b>Example 2:</b><br>
Corn takes 14 days to grow after the day it is planted. In Spring and Fall, it is planted once and can be harvested 11 times, and regrows every 4 days. The last harvest occurs on Day 55. Seeds cost 150g, and Corn sells for 50g.
<pre>
((11 * 50g) - (150g * 1)) / (55 - 1)
400g / 54
<b>= 7.4g/day</b>
</pre>
