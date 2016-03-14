angular.module("planner_app", [])
	.controller("planner_controller", planner_controller);
	
function planner_controller($scope){
	var self = this;
	self.days = new Array(28*4);
	self.seasons = ["spring", "summer", "fall", "winter"];
	self.loaded = false;
	
	// Planner modal
	self.planner = $("#crop_planner");
	self.open_plans = open_plans;
	self.close_plans = close_plans;
	self.get_date = get_date;
	
	// Seasons
	self.cdate;					// Currently open date
	self.cseason = "spring";	// Current season
	self.set_season = set_season;
	self.in_season = in_season;
	
	// Crop data
	self.crops_list = []; 		// [id, id, ...]
	self.crops = {}; 			// {id: {data}}
	
	// Planner data
	self.data = {plans: {}, harvests: {}, totals: {}};
	self.newplan = new Plan;
	self.add_plan = add_plan;
	self.add_plan_key = add_plan_key;
	self.remove_plan = remove_plan;
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
				$.each(data, function(season, crops){
					$.each(crops, function(i, crop){
						if (!crop.seasons) crop.seasons = [season];
						self.crops_list.push(crop.id);
						self.crops[crop.id] = crop;
					});
				});
				
				var plan_count = load_data();
				
				console.log("Loaded "+self.crops_list.length+" crops.");
				console.log("Loaded "+plan_count+" plans.");
				
				update(self.data);
				self.loaded = true;
				$scope.$apply();
			}
		});
	}
	
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
	
	// Open crop planner modal
	function open_plans(date){
		self.planner.modal();
		self.cdate = date;
	}
	
	// Close crop planner modal
	function close_plans(){
		self.planner.modal("hide");
	}
	
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
		update(self.data);
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
		update(self.data);
	}
	
	// Update planner info
	function update(data){
		// Reset harvests
		data.harvests = [];
		
		// Reset financial totals
		data.totals = {};
		data.totals.day = {};
		data.totals.season = [new Finance, new Finance, new Finance, new Finance];
		data.totals.year = new Finance;
		
		// Rebuild data
		$.each(data.plans, function(date, plans){
			date = parseInt(date);
			
			$.each(plans, function(i, plan){
				var crop = self.crops[plan.crop];
				var first_harvest = date + crop.grow;
				var season = Math.floor((plan.date-1)/28);
				var season_start = (season * 28)+1;
				var season_end = season_start + 27;
				
				// Custom start/end growth dates
				if (crop.start) season_start = crop.start;
				if (crop.end) season_end = crop.end;
				
				if (first_harvest > season_end) return;
				
				// Initial harvest
				var harvests = [];
				harvests.push(create_harvest(plan, first_harvest));
				
				// Regrowth harvests
				if (crop.regrow){
					var regrowths = Math.floor((season_end-first_harvest)/crop.regrow);
					for (var i=1; i<=regrowths; i++){
						var regrow_date = first_harvest + (i*crop.regrow);
						if (regrow_date > season_end) break;
						harvests.push(create_harvest(plan, regrow_date, true));
					}
				}
				
				plan.harvests = harvests;
				
				// Add up all harvests
				for (var i=0; i<harvests.length; i++){
					var harvest = harvests[i];
					var p_season = Math.floor((harvest.date-1)/28);
					var h_season = Math.floor((harvest.date-1)/28);
					
					// Update harvests
					if (!data.harvests[harvest.date]) data.harvests[harvest.date] = [];
					data.harvests[harvest.date].push(harvest);
					
					// Update daily totals
					if (!data.totals.day[date]) data.totals.day[date] = new Finance;
					if (!data.totals.day[harvest.date]) data.totals.day[harvest.date] = new Finance;
					var d_plant = data.totals.day[date];
					var d_harvest = data.totals.day[harvest.date];
					
					d_plant.profit -= harvest.cost;
					d_harvest.profit += harvest.revenue;
					
					// Update seasonal totals
					var sp_total = data.totals.season[season];
					var sh_total = data.totals.season[h_season];
					
					sp_total.profit -= harvest.cost;
					sh_total.profit += harvest.revenue;
					
					// Update annual totals
					var y_total = data.totals.year;
					y_total.revenue += harvest.revenue;
					y_total.cost += harvest.cost;
					y_total.profit += harvest.profit;
				}
			});
		});	
	}
	
	// Create harvest object from given data
	function create_harvest(plan, date, is_regrowth){
		var crop = self.crops[plan.crop];
		var harvest = new Harvest;
		harvest.date = date;
		harvest.crop = crop;
		
		// Harvest yield
		var yield = crop.yield ? crop.yield : 1;
		if (crop.regrow_yield && is_regrowth) yield = crop.regrow_yield;
		harvest.yield = Math.floor(yield * plan.amount);
		
		// Harvest revenue and costs
		harvest.revenue = crop.sell[0] * harvest.yield;
		harvest.cost = (crop.buy * plan.amount) + (20 * plan.fertilizer);
		
		// Regrowth
		if (is_regrowth){
			harvest.is_regrowth = true;
			harvest.cost = 0;
		}
		
		// Harvest profit
		harvest.profit = harvest.revenue - harvest.cost;
		return harvest;
	}
	
	// Set current season
	function set_season(season){
		self.cseason = season;
	}
	
	// Check if crop can grow in a season
	function in_season(crop, season){
		return crop.seasons.indexOf(season) > -1;
	}
	
	
	/********************************
		CLASSES
	********************************/
	// Harvest class
	function Harvest(){
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
	
	// Plan class
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
	
	// Finance class
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
		season = season.charAt(0).toUpperCase() + season.slice(1);
		
		var str = format.replace("%l", day)
						.replace("%j", date)
						.replace("%S", nth)
						.replace("%F", season);
		
		return str;
	}
}
