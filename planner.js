// Angular app
angular.module("planner_app", [])
	.controller("planner_controller", planner_controller);
	
function planner_controller($scope){
	var self = this; window.planner = self;
	
	// Core data
	self.config = {};
	self.loaded = false;
	self.data = {plans: {}, harvests: {}, totals: {}};
	self.update = update;
	
	// Seasons
	self.days = new Array(28*4);
	self.cdate;
	self.seasons = [new Season(0), new Season(1), new Season(2), new Season(3)];
	self.cseason = self.seasons[0];
	self.get_season = get_season;
	self.set_season = set_season;
	
	// Crops
	self.crops_list = []; 			// [id, id, ...]
	self.crops = {}; 				// {id: {data}}
	
	// Planner
	self.fertilizer = {}; 			// [fertilizer, fertilizer, ...]
	self.newplan;
	self.add_plan = add_plan;
	self.add_plan_key = add_plan_key;
	self.remove_plan = remove_plan;
	self.clear_season = clear_season;
	self.clear_all = clear_all;
	
	// Planner modal
	self.planner_modal = $("#crop_planner");
	self.open_plans = open_plans;
	self.close_plans = close_plans;
	self.get_date = get_date;
	
	// Crop info modal
	self.cinfo_settings = {season: "spring", sort: "profit", order: false};
	self.open_crop_info = open_crop_info;
	self.cinfo_set_sort = cinfo_set_sort;
	
	
	init();
	
	
	/********************************
		CORE PLANNER FUNCTIONS
	********************************/
	function init(){
		// Initialize planner data
		for (var i=0; i<self.days.length; i++){
			self.days[i] = i+1;
			self.data.plans[i+1] = [];
		}
		self.data.totals.season = [new Finance, new Finance, new Finance, new Finance];
		
		// Enable bootstrap tooltips
		$("body").tooltip({selector: "[rel=tooltip]"});
		
		// Load planner config data
		$.ajax({
			url: "config.json",
			dataType: "json",
			success: function(config){
				self.config = config;
				
				// Process crop data
				$.each(self.config.crops, function(season, crops){
					$.each(crops, function(i, crop){
						if (!crop.seasons) crop.seasons = [season];
						crop = new Crop(crop);
						self.crops_list.push(crop);
						self.crops[crop.id] = crop;
					});
				});
				
				// Process fertilizer data
				$.each(self.config.fertilizer, function(i, fertilizer){
					fertilizer = new Fertilizer(fertilizer);
					self.config.fertilizer[i] = fertilizer;
					self.fertilizer[fertilizer.id] = fertilizer;
				});
				
				// Load saved plans from browser storage
				var plan_count = load_data();
				self.loaded = true;
				
				// Debug info
				console.log("Loaded "+self.crops_list.length+" crops.");
				console.log("Loaded "+plan_count+" plans.");
				
				// Update plans
				self.newplan = new Plan;
				update();
				$scope.$apply();
			},
			error: function(xhr, status, error){
				if (!xhr.responseText) return;
				console.log("Error: ", status);
				console.log("Reason: ", error);
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
				var crop = plan.crop;
				var first_harvest = date + plan.get_grow_time();
				var season = self.seasons[Math.floor((plan.date-1)/28)];
				var crop_end = crop.end;
				
				if (plan.greenhouse){
					crop_end = self.days.length;
				}
				
				if (first_harvest > crop_end) return;
				
				// Initial harvest
				var harvests = [];
				harvests.push(new Harvest(plan, first_harvest));
				
				// Regrowth harvests
				if (crop.regrow){
					var regrowths = Math.floor((crop_end-first_harvest)/crop.regrow);
					for (var i=1; i<=regrowths; i++){
						var regrow_date = first_harvest + (i*crop.regrow);
						if (regrow_date > crop_end) break;
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
	
	
	/********************************
		CLASSES
	********************************/
	
	/****************
		Season class - representing one of the four seasons
	****************/
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
	
	// Get season object by id name
	function get_season(id){
		for (var i=0; i<self.seasons.length; i++){
			if (self.seasons[i].id == id) return self.seasons[i];
		}
	}
	
	// Set current season
	function set_season(index){
		self.cseason = self.seasons[index];
		self.newplan.crop_id = null;
	}
	
	
	/****************
		Crop class - represents a crop
	****************/
	function Crop(data){
		var self = this;
		self.id;
		self.name = "";
		self.buy = 0;
		self.sell = [0, 0, 0];
		self.stages = [1];
		self.grow = 0;
		self.yield = 1;
		self.regrow;
		self.regrow_yield = 1;
		self.note = "";
		self.seasons = [];
		self.start = 0;
		self.end = 0;
		
		self.profit = 0; // profit per day
		
		self.can_grow = can_grow;
		self.get_url = get_url;
		self.get_image = get_image;
		
		
		init();
		
		
		function init(){
			if (!data) return;
			
			// Base properties
			self.id = data.id;
			self.name = data.name;
			self.buy = data.buy;
			self.sell = data.sell;
			
			self.stages = data.stages;
			self.grow = 0;
			for (var i = 0; i < data.stages.length; i++){
				self.grow += data.stages[i];
			}
			
			
			// Specialized properties
			if (data.yield) self.yield = data.yield;
			if (data.regrow) self.regrow = data.regrow;
			if (data.regrow_yield){
				self.regrow_yield = data.regrow_yield;
			} else {
				self.regrow_yield = self.yield;
			}
			if (data.note) self.note = data.note;
			self.seasons = data.seasons;
			self.start = get_season(data.seasons[0]).start;
			self.end = get_season(data.seasons[data.seasons.length-1]).end;
			
			// Calculate profit per day
			var season_days = (self.end - self.start) + 1;
			var regrowths = self.regrow ? Math.floor(((season_days-1)-self.grow)/self.regrow) : 0;
			
			var plantings = 1;
			if (!regrowths) plantings = Math.floor((season_days-1)/self.grow);
			var growth_days = (plantings * self.grow) + (regrowths * (self.regrow ? self.regrow : 0));
			
			self.profit -= self.buy * plantings;
			self.profit += self.yield * self.sell[0] * plantings;
			self.profit += regrowths * self.regrow_yield * self.sell[0];
			self.profit = Math.round((self.profit/growth_days) * 10) / 10;
		}
		
		// Check if crop can grow on date/season
		function can_grow(date, is_season, in_greenhouse){
			if (in_greenhouse && (date <= planner.days.length)) return true;
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
				fragment[i] = fragment[i].charAt(0).toUpperCase() + fragment[i].slice(1);
			}
			fragment = fragment.join("_");
			return "http://stardewvalleywiki.com/Crops#"+fragment;
		}
		
		// Get thumbnail image
		function get_image(seeds){
			if (seeds && self.seasons[0] == "winter") return "images/seeds/winter.png";
			if (seeds) return "images/seeds/"+self.id+".png";
			return "images/"+self.id+".png";
		}
	}
	
	/****************
		Harvest class - represents crops harvested on a date
	****************/
	function Harvest(plan, date, is_regrowth){
		var self = this;
		self.date = 0;
		self.plan = {};
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
			var crop = plan.crop;
			self.plan = plan;
			self.crop = crop;
			self.date = date;
			
			// Harvest yield
			var yield = crop.yield ? crop.yield : 1;
			if (crop.regrow_yield && is_regrowth) yield = crop.regrow_yield;
			self.yield = Math.floor(yield * plan.amount);
			
			// Harvest revenue and costs
			self.revenue = crop.sell[0] * self.yield;
			self.cost = crop.buy * plan.amount;
			
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
	
	/****************
		Plan class - represents seeds planted on a date
	****************/
	function Plan(data){
		var self = this;
		self.date;
		self.crop_id;
		self.crop = {};
		self.amount = 1;
		self.fertilizer = planner.fertilizer["none"];
		self.greenhouse = false;
		
		self.harvests = [];
		
		self.get_data = get_data;
		self.get_grow_time = get_grow_time;
		self.get_cost = get_cost;
		self.get_revenue = get_revenue;
		self.get_profit = get_profit;
		
		
		init();
		
		
		function init(){
			if (!data) return;
			self.date = data.date;
			self.crop = planner.crops[data.crop];
			self.amount = data.amount;
			self.greenhouse = data.greenhouse ? true : false;
			if (data.fertilizer && planner.fertilizer[data.fertilizer])
				self.fertilizer = planner.fertilizer[data.fertilizer];
		}
		
		// Compile data to be saved as JSON
		function get_data(){
			var data = {};
			data.crop = self.crop.id;
			data.amount = self.amount;
			if (self.greenhouse) data.greenhouse = true;
			if (self.fertilizer && !self.fertilizer.is_none()) data.fertilizer = self.fertilizer.id;
			return data;
		}
		
		function get_grow_time(){
			var days = self.crop.grow;
			
			if (self.fertilizer.id == "speed_gro" || self.fertilizer.id == "delux_speed_gro"){
				// The following may not make sense, but this is how the
				// sped-up growth rate is calculated in game (as of v1.05)
				var rate = 0.25;
				if (self.fertilizer.id == "speed_gro") rate = 0.1;
				// if (Agriculturist) rate += 0.1; // coming soon
				
				var remove_days = Math.ceil(days * rate);
				var stages = self.crop.stages;
				days = days - Math.min(stages.length - (stages[0] <= 1 ? 1 : 0), remove_days);
			}
		
			return days;
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
	
	// Add self.newplan to plans list
	function add_plan(date, auto_replant){
		// Validate data
		if (!self.newplan.crop_id) return false;
		
		// Date is out of bounds
		if (!planner.data.plans[date]) return false;
		
		// Check that crop can grow
		var crop = self.crops[self.newplan.crop_id];
		if (!crop.can_grow(date, false, self.newplan.greenhouse)) return false;
		self.newplan.crop = crop;
		
		// Amount to plant
		self.newplan.amount = parseInt(self.newplan.amount || 0);
		if (self.newplan.amount <= 0) return false;
		
		// Add plan
		var plan = new Plan(self.newplan.get_data());
		plan.date = date;
		self.data.plans[date].push(plan);
		
		//int days_to_remove = (int)Math.Ceiling((double)days_to_grow * (double)speed);
		
		// Auto-replanting
		var crop_growth = plan.get_grow_time();
		var next_planting = date + crop_growth;
		var next_grow = next_planting + crop_growth;
		if (!auto_replant || crop.regrow || (auto_replant && !crop.can_grow(next_grow, false, self.newplan.greenhouse))){
			// Reset plan template
			self.newplan = new Plan;
			
			// Update
			update();
			save_data();
		} else if (auto_replant){
			// Auto-replant
			add_plan(next_planting, true);
		}
	}
	
	// Add plan to plans list on enter keypress
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
	
	/****************
		Fertilizer class - represents a type of fertilizer
	****************/
	function Fertilizer(data){
		var self = this;
		self.id;
		self.name;
		self.buy = 0;
		self.quality = [0, 0, 0]; // for quality-modifying fertilizers
		self.growth_rate = 0; // for growth-modifying fertilizers
		self.is_none = is_none;
		self.get_image = get_image;
		
		
		init();
		
		
		function init(){
			if (!data) return;
			self.id = data.id;
			self.name = data.name;
			self.buy = data.buy;
			if (data.quality) self.quality = data.quality;
			if (data.growth_rate) self.growth_rate = data.growth_rate;
		}
		
		function is_none(){
			return self.id == "none";
		}
		
		function get_image(){
			if (!self.is_none()) return "images/fertilizer/"+self.id+".png";
		}
	}
	
	/****************
		Finance class - financial details of a day/season/year
	****************/
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
		PLANNER MODAL FUNCTIONS
	********************************/
	// Open crop planner modal
	function open_plans(date){
		self.planner_modal.modal();
		self.cdate = date;
	}
	
	// Close crop planner modal
	function close_plans(){
		self.planner_modal.modal("hide");
	}
	
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
	
	
	/********************************
		CROP INFO FUNCTIONS
	********************************/
	function open_crop_info(){
		$("#crop_info").modal();
		self.cinfo_settings.season = self.cseason.id;
	}
	
	
	function cinfo_set_sort(key){
		if (self.cinfo_settings.sort == key){
			self.cinfo_settings.order = !self.cinfo_settings.order;
		} else {
			self.cinfo_settings.sort = key;
			self.cinfo_settings.order = false;
		}
	}
}