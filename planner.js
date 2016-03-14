// Capitalize first letter of word
String.prototype.ucfirst = function() {
	return this.charAt(0).toUpperCase() + this.slice(1);
}

// Angular app
angular.module("planner_app", [])
	.controller("planner_controller", planner_controller);
	
function planner_controller($scope){
	var self = this; window.planner = self;
	
	self.days = new Array(28*4);
	self.seasons = [new Season(0), new Season(1), new Season(2), new Season(3)];
	self.loaded = false;
	
	// Planner modal
	self.planner = $("#crop_planner");
	self.open_plans = open_plans;
	self.close_plans = close_plans;
	self.get_date = get_date;
	
	// Seasons
	self.cdate;						// Currently open date
	self.cseason = self.seasons[0];	// Current season
	self.get_season = get_season;
	self.set_season = set_season;
	
	// Crop data
	self.crops_list = []; 			// [id, id, ...]
	self.crops = {}; 				// {id: {data}}
	self.open_crop_info = open_crop_info;
	self.crop_info;
	self.cinfo_profit = cinfo_profit;
	self.cinfo_settings = {season: "spring"};
	
	// Planner data
	self.data = {plans: {}, harvests: {}, totals: {}};
	self.newplan = new Plan;
	self.add_plan = add_plan;
	self.add_plan_key = add_plan_key;
	self.remove_plan = remove_plan;
	self.clear_season = clear_season;
	self.clear_all = clear_all;
	self.update = update;
	
	
	init();
	
	
	function init(){
		// Initialize planner data
		for (var i=0; i<self.days.length; i++){
			self.days[i] = i+1;
			self.data.plans[i+1] = [];
		}
		self.data.totals.season = [new Finance, new Finance, new Finance, new Finance];
		
		// Load crop data
		$.ajax({
			url: "crops.json",
			dataType: "json",
			success: function(data){
				// Process received crop data
				$.each(data, function(season, crops){
					$.each(crops, function(i, crop){
						if (!crop.seasons) crop.seasons = [season];
						crop = new Crop(crop);
						self.crops_list.push(crop.id);
						self.crops[crop.id] = crop;
					});
				});
				
				// Load stored plans
				var plan_count = load_data();
				self.loaded = true;
				
				// Debug info
				console.log("Loaded "+self.crops_list.length+" crops.");
				console.log("Loaded "+plan_count+" plans.");
				
				// Update plans
				update();
				$scope.$apply();
			}
		});
	}
	
	
	/********************************
		SAVE/LOAD
	********************************/
	// Save plan data to localstorage
	function save_data(){
		var data = {};
		$.each(self.data.plans, function(date, plans){
			if (!plans.length) return;
			data[date] = [];
			$.each(plans, function(i, plan){
				data[date].push(plan.get_data());
			});
		});
		data = JSON.stringify(data);
		localStorage.setItem("crops", data);
	}
	
	// Load plan data from localstorage
	function load_data(){
		var data = JSON.parse(localStorage.getItem("crops"));
		if (!data) return;
		
		var plan_count = 0;
		$.each(data, function(date, plans){
			date = parseInt(date);
			$.each(plans, function(i, plan){
				plan.date = date;
				var plan_object = new Plan(plan);
				self.data.plans[date].push(plan_object);
				plan_count++;
			});
		});
		
		return plan_count;
	}
	
	
	/********************************
		PLANNER MODAL
	********************************/
	// Open crop planner modal
	function open_plans(date){
		self.planner.modal();
		self.cdate = date;
	}
	
	// Close crop planner modal
	function close_plans(){
		self.planner.modal("hide");
	}
	
	
	/********************************
		ADD/REMOVE PLANS
	********************************/
	// Add self.newplan to plans list
	function add_plan(date){
		// Validate data
		if (!self.newplan.crop) return;
		
		self.newplan.amount = parseInt(self.newplan.amount || 0);
		if (self.newplan.amount <= 0) return;
		
		self.newplan.fertilizer = parseInt(self.newplan.fertilizer || 0);
		if (self.newplan.fertilizer <= 0) self.newplan.fertilizer = 0;
		
		// Copy new plan
		var plan = self.newplan;
		self.newplan = new Plan;
		
		plan.date = date;
		self.data.plans[date].push(plan);
		update();
		save_data();
	}
	
	// Ad plan to plans list on enter keypress
	function add_plan_key(date, e){
		if (e.which == 13) add_plan(date);
	}
	
	// Remove plan from plans list
	function remove_plan(date, index){
		self.data.plans[date].splice(index, 1);
		save_data();
		update();
	}
	
	// Remove plans from current season
	function clear_season(){
		for (var date=self.cseason.start; date<=self.cseason.end; date++){
			self.data.plans[date] = [];
		}
		save_data();
		update();
	}
	
	// Remove all plans
	function clear_all(){
		for (var i=0; i<self.days.length; i++){
			self.data.plans[i+1] = [];
		}
		save_data();
		update();
	}
	
	
	/********************************
		GENERAL PLANNER FUNCTIONS
	********************************/
	// Update planner info
	function update(){
		// Reset harvests
		self.data.harvests = [];
		
		// Reset financial totals
		self.data.totals = {};
		self.data.totals.day = {};
		self.data.totals.season = [new Finance, new Finance, new Finance, new Finance];
		self.data.totals.year = new Finance;
		
		// Rebuild data
		$.each(self.data.plans, function(date, plans){
			date = parseInt(date);
			
			$.each(plans, function(i, plan){
				var crop = self.crops[plan.crop];
				var first_harvest = date + crop.grow;
				var season = self.seasons[Math.floor((plan.date-1)/28)];
				
				if (first_harvest > crop.end) return;
				
				// Initial harvest
				var harvests = [];
				harvests.push(new Harvest(plan, first_harvest));
				
				// Regrowth harvests
				if (crop.regrow){
					var regrowths = Math.floor((crop.end-first_harvest)/crop.regrow);
					for (var i=1; i<=regrowths; i++){
						var regrow_date = first_harvest + (i*crop.regrow);
						if (regrow_date > crop.end) break;
						harvests.push(new Harvest(plan, regrow_date, true));
					}
				}
				plan.harvests = harvests;
				
				// Add up all harvests
				for (var i=0; i<harvests.length; i++){
					var harvest = harvests[i];
					
					// Update harvests
					if (!self.data.harvests[harvest.date]) self.data.harvests[harvest.date] = [];
					self.data.harvests[harvest.date].push(harvest);
					
					// Update daily totals
					if (!self.data.totals.day[date]) self.data.totals.day[date] = new Finance;
					if (!self.data.totals.day[harvest.date]) self.data.totals.day[harvest.date] = new Finance;
					var d_plant = self.data.totals.day[date];
					var d_harvest = self.data.totals.day[harvest.date];
					
					d_plant.profit -= harvest.cost;
					d_harvest.profit += harvest.revenue;
					
					// Update seasonal totals
					var h_season = Math.floor((harvest.date-1)/28);
					var s_plant_total = self.data.totals.season[season.index];
					var s_harvest_total = self.data.totals.season[h_season];
					
					s_plant_total.profit -= harvest.cost;
					s_harvest_total.profit += harvest.revenue;
					
					// Update annual totals
					var y_total = self.data.totals.year;
					y_total.revenue += harvest.revenue;
					y_total.cost += harvest.cost;
					y_total.profit += harvest.profit;
				}
			});
		});	
	}
	
	// Get season object by id name
	function get_season(id){
		for (var i=0; i<self.seasons.length; i++){
			if (self.seasons[i].id == id) return self.seasons[i];
		}
	}
	
	// Set current season
	function set_season(index){
		self.cseason = self.seasons[index];
	}
	
	
	/********************************
		CLASSES
	********************************/
	// Crop class - represents a crop
	function Crop(data){
		var self = this;
		self.id;
		self.name = "";
		self.buy = 0;
		self.sell = [0, 0, 0];
		self.grow = 0;
		self.yield = 1;
		self.regrow;
		self.regrow_yield = 1;
		self.joja = false;
		self.start = 0;
		self.end = 0;
		self.can_grow = can_grow;
		self.get_url = get_url;
		
		
		init();
		
		
		function init(){
			if (!data) return;
			
			// Base properties
			self.id = data.id;
			self.name = data.name;
			self.buy = data.buy;
			self.sell = data.sell;
			self.grow = data.grow;
			
			// Specialized properties
			if (data.yield) self.yield = data.yield;
			if (data.regrow) self.regrow = data.regrow;
			if (data.regrow_yield) self.regrow_yield = data.regrow_yield;
			if (data.joja) self.joja = data.joja;
			self.seasons = data.seasons;
			self.start = get_season(data.seasons[0]).start;
			self.end = get_season(data.seasons[data.seasons.length-1]).end;
		}
		
		// Check if crop can grow on date/season
		function can_grow(date, is_season){
			if (is_season){
				var season = date;
				if (typeof season == "string") season = get_season(season);
				return (self.start <= season.start) && (self.end >= season.end);
			} else {
				return (date >= self.start) && (date <= self.end);
			}
		}
		
		// Get url to Stardew Valley wiki
		function get_url(){
			var fragment = self.id.split("_");
			for (var i=0; i<fragment.length; i++){
				fragment[i] = fragment[i].ucfirst();
			}
			fragment = fragment.join("_");
			return "http://stardewvalleywiki.com/Crops#"+fragment;
		}
	}
	
	// Harvest class - represents crops harvested on a date
	function Harvest(plan, date, is_regrowth){
		var self = this;
		self.date = 0;
		self.crop = {};
		self.amount = 0;
		self.revenue = 0;
		self.cost = 0;
		self.profit = 0;
		self.is_regrowth = false;
		
		self.get_cost = get_cost;
		self.get_revenue = get_revenue;
		self.get_profit = get_profit;
		
		
		init();
		
		
		function init(){
			if (!plan || !date) return;
			var crop = planner.crops[plan.crop];
			self.crop = crop;
			self.date = date;
			
			// Harvest yield
			var yield = crop.yield ? crop.yield : 1;
			if (crop.regrow_yield && is_regrowth) yield = crop.regrow_yield;
			self.yield = Math.floor(yield * plan.amount);
			
			// Harvest revenue and costs
			self.revenue = crop.sell[0] * self.yield;
			self.cost = (crop.buy * plan.amount) + (20 * plan.fertilizer);
			
			// Regrowth
			if (is_regrowth){
				self.is_regrowth = true;
				self.cost = 0;
			}
			
			// Harvest profit
			self.profit = self.revenue - self.cost;
		}
		
		function get_cost(locale){
			if (locale) return self.cost.toLocaleString();
			return self.cost;
		}
		
		function get_revenue(locale){
			if (locale) return self.revenue.toLocaleString();
			return self.revenue;
		}
		
		function get_profit(locale){
			if (locale) return self.profit.toLocaleString();
			return self.profit;
		}
	}
	
	// Plan class - represents seeds planted on a date
	function Plan(data){
		var self = this;
		self.date;
		self.crop;
		self.amount = 1;
		self.fertilizer = 0;
		self.harvests = [];
		
		self.get_data = get_data;
		self.get_cost = get_cost;
		self.get_revenue = get_revenue;
		self.get_profit = get_profit;
		
		
		init();
		
		
		function init(){
			if (!data) return;
			self.date = data.date;
			self.crop = data.crop;
			self.amount = data.amount;
			self.fertilizer = data.fertilizer;
		}
		
		function get_data(){
			var data = {};
			data.crop = self.crop;
			data.amount = self.amount;
			data.fertilizer = self.fertilizer;
			return data;
		}
		
		function get_cost(locale){
			var amount = 0;
			for (var i=0; i<self.harvests.length; i++){
				amount += self.harvests[i].cost;
			}
			if (locale) return amount.toLocaleString();
			return amount;
		}
		
		function get_revenue(locale){
			var amount = 0;
			for (var i=0; i<self.harvests.length; i++){
				amount += self.harvests[i].revenue;
			}
			if (locale) return amount.toLocaleString();
			return amount;
		}
		
		function get_profit(locale){
			var amount = get_revenue() - get_cost();
			if (locale) return amount.toLocaleString();
			return amount;
		}
	}
	
	// Finance class - financial details of a day/season/year
	function Finance(){
		var self = this;
		self.revenue = 0;
		self.cost = 0;
		self.profit = 0;
		
		self.get_cost = get_cost;
		self.get_revenue = get_revenue;
		self.get_profit = get_profit;
		
		function get_cost(locale){
			if (locale) return self.cost.toLocaleString();
			return self.cost;
		}
		
		function get_revenue(locale){
			if (locale) return self.revenue.toLocaleString();
			return self.revenue;
		}
		
		function get_profit(locale){
			if (locale) return self.profit.toLocaleString();
			return self.profit;
		}
	}
	
	// Season class - representing one of the four seasons
	function Season(ind){
		var self = this;
		self.index = ind;
		self.id;
		self.name;
		self.start = 0;
		self.end = 0;
		
		
		init();
		
		
		function init(){
			var seasons = ["spring", "summer", "fall", "winter"];
			self.id = seasons[self.index];
			self.name = self.id.charAt(0).toUpperCase() + self.id.slice(1);
			self.start = (self.index*28)+1;
			self.end = self.start + 27;
		}
	}
	
	
	/********************************
		CROP INFO FUNCTIONS
	********************************/
	function open_crop_info(){
		$("#crop_info").modal();
		
		// Compile crop info
		if (!self.crop_info){
			self.crop_info = {};
			for (var i=0; i<self.crops_list.length; i++){
				var info = {};
				var crop = self.crops[self.crops_list[i]];
				info.crop = crop;
				info.profit = 0;
				
				// Monthly profit
				var days = (crop.end - crop.start) + 1;
				var regrowths = crop.regrow ? Math.floor(((days-1)-crop.grow)/crop.regrow) : 0;
				var regrow_yields = crop.regrow_yields ? crop.regrow_yields : 1;
				
				var plantings = 1;
				if (!regrowths) plantings = Math.floor((days-1)/crop.grow);
				
				info.profit -= crop.buy * plantings;
				info.profit += crop.yield * crop.sell[0] * plantings;
				info.profit += regrowths * regrow_yields * crop.sell[0];
				info.profit = Math.round((info.profit/days) * 10) / 10;
				
				self.crop_info[crop.id] = info;
			}
		}
	}
	
	function cinfo_profit(cid){
		if (!self.crop_info) return 0;
		return self.crop_info[cid].profit;
	}
	
	
	/********************************
		MISC FUNCTIONS
	********************************/
	// Get formatted date
	function get_date(real_date, format){
		if (!real_date) real_date = self.cdate;
		if (!real_date) return;
		date = real_date % 28 ? real_date % 28 : 28;
		var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
		var nth = "th"; // st nd rd th
		if (date <= 3 || date >= 21){
			switch((date % 100) % 10){
				case 1: nth = "st"; break;
				case 2: nth = "nd"; break;
				case 3: nth = "rd"; break;
			}
		}
		
		var day = days[date%7];
		var season = self.seasons[Math.floor((real_date-1)/28)];
		season = season.name;
		
		var str = format.replace("%l", day)
						.replace("%j", date)
						.replace("%S", nth)
						.replace("%F", season);
		
		return str;
	}
}