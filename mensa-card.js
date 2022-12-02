var url = "https://openmensa.org/api/v2/canteens/";

function httpGet(theUrl, retry, params, callback) {
    console.log("Requesting: " + theUrl);
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() { 
        if (xmlHttp.readyState == 4) {
            if (xmlHttp.status == 200)
                callback(xmlHttp.responseText, params);
            else if (retry)
                setTimeout(() => { httpGet(theUrl, true, params, callback); }, 2000);
            else 
                callback(null, params);
        }    
    }
    xmlHttp.open("GET", theUrl, true); // true for asynchronous 
    xmlHttp.send(null);
}

function removeAllChildNodes(parent) {
    while (parent.firstChild)
        parent.removeChild(parent.firstChild);
}

function parseDate(plus) {
    var date = new Date();
    date.setDate(date.getDate() + plus);
    
    var dd = String(date.getDate()).padStart(2, '0');
    var mm = String(date.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = date.getFullYear();

    return yyyy + "-" + mm + "-" + dd;
}

Date.prototype.addHours = function(h){
    this.setHours(this.getHours()+h);
    return this;
}
Date.prototype.getWeekDay = function() {
    var weekday = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
    return weekday[this.getDay()];
}

class MensaCard extends HTMLElement {
    constructor() {
        super();
    }

    mensas = [];
    currentMensa = null;

    set hass(hass) {
        // Initialize the content if it's not there yet.
        if (!this.content) {
            this.innerHTML = `
                <ha-card>
                    <div class="card-content">
                        <div id="tabBtns">Loading...</div>
                        <div id="tabContainer"></div>
                        <button id="showMoreBtn">Mehr anzeigen</button>
                    </div>
                    <style id="style"></style>
                </ha-card>
            `;
            this.content = this.querySelector('div');

            var showMoreBtn = this.querySelector("#showMoreBtn");
            showMoreBtn.onclick = function() {
                var days = this.parentElement.querySelectorAll(".dayContainer");
                days.forEach(function(day) {
                    day.style.display = "block";
                });
                this.style.display = "none";
            };

            this.querySelector("#style").innerHTML = MensaCard.styles;

            this.loadMensas();
        }
    }

    refreshAll() {
        this.generateTabBtns();
        this.refreshTabContent();
    }

    refreshTabContent() {
        // Activate clicked button
        var tabBtns = this.querySelectorAll('.tabBtn');
        var that = this;
        tabBtns.forEach(function(tabBtn) {
            if (tabBtn.getAttribute("mensa-id") == that.currentMensa.id)
                tabBtn.classList.add("active");
            else
                tabBtn.classList.remove("active");

            that.mensas.forEach(function(mensa) {
                if (mensa.id == tabBtn.getAttribute("mensa-id")) {
                    if (mensa.has_meals)
                        tabBtn.classList.remove("no-meals");
                    else
                        tabBtn.classList.add("no-meals");
                }
            });
        });

        var tabContainer = this.querySelector('#tabContainer');
        removeAllChildNodes(tabContainer);
        tabContainer.appendChild(that.generateTabContent(this.currentMensa));
    }

    loadMensas() {
        var that = this;
        this.config.mensa_ids.forEach(function(mensa_id) {
            var mensa = { id: mensa_id };
            if (that.currentMensa === null)
                that.currentMensa = mensa;
            that.mensas.push(mensa);
            httpGet(url + mensa_id, true, null, function(response, params) {
                Object.assign(mensa, JSON.parse(response));
                mensa.days = [];
                mensa.url = url + mensa_id + "/";
                that.loadMensaDays(mensa);
                that.refreshAll();
            });
        });
    }

    loadMensaDays(mensa) {
        var that = this;
        httpGet(mensa.url + "days/", true, null, function(result, params) {
            if (result === null) {
                //TODO: Show error
                return;
            }

            var days = JSON.parse(result);
            mensa.days = days;
            mensa.has_meals = false;
            days.forEach(function(day) {
                day.meals = [];
            });
            if (mensa === that.currentMensa)
                that.refreshTabContent();
            days.forEach(function(day) {
                that.loadMensaMeals(mensa, day);
            });
        });
    }

    loadMensaMeals(mensa, day) {
        var that = this;
        httpGet(mensa.url + "days/" + day.date + "/meals", true, null, function(result, params) {
            if (result === null) {
                //TODO: Show error
                return;
            }

            var meals = JSON.parse(result);
            meals = meals.filter(function(meal) {
                return meal.category != "Info" && 
                    meal.name.replace(".", "").replace(" ", "").length > 0;
            });
            var has_meals = meals.length > 0;
            day.meals = meals;
            if (mensa.has_meals === false &&
                    (mensa === that.currentMensa || mensa.has_meals != has_meals)) {
                mensa.has_meals = true;
                that.refreshTabContent();
            }
            else if (mensa === that.currentMensa)
                that.refreshTabContent();
        });
    }
    
    generateTabBtns() {
        var tabBtns = this.querySelector('#tabBtns');
        removeAllChildNodes(tabBtns);
        var that = this;

        this.mensas.forEach(function(mensa) {
            if (mensa.name === undefined)
                return;

            var btn = document.createElement('button');
            btn.innerHTML = mensa.name.replace("Mensa ", "");
            btn.className = "tabBtn";
            btn.setAttribute("mensa-id", mensa.id);
            btn.onclick = function() {
                that.currentMensa = mensa;
                that.refreshTabContent();
            };
            tabBtns.appendChild(btn);
        });
    }

    generateTabContent(mensa) {
        console.log(mensa)
        var tabContent = document.createElement('div');
        tabContent.className = "tabContent";

        var days_with_meals = 0;
        mensa.days.forEach(function(day) {
            var dayContainer = document.createElement('div');
            dayContainer.className = "dayContainer";
            if (days_with_meals >= 2)
                dayContainer.style.display = "none";
            
            var day_title = document.createElement("h3");
            if (day.date == parseDate(0))
                day_title.innerHTML = "Heute";
            else if (day.date == parseDate(1))
                day_title.innerHTML = "Morgen";
			else
                day_title.innerHTML = new Date(day.date).getWeekDay();
            dayContainer.appendChild(day_title);

            var meals_list = document.createElement("table");
            meals_list.className = "meals_list";
            // var meals_list_header = document.createElement("tr");
            // meals_list_header.innerHTML = "<th style='text-align: left'>Gericht</th><th>Preis</th>";
            // meals_list.appendChild(meals_list_header);

            var meals_list_body = document.createElement("tbody");
            var found_meals = false;
            day.meals.forEach(function(meal) {
                var meal_item = document.createElement("tr");
                var price = meal.prices.students;
                if (price !== null) {
                    price = price.toFixed(2);
                    meal_item.innerHTML = "<td>" + meal.name + "</td><td class='price-cell'>" + price + " €</td>";
                }
                else {
                    meal_item.innerHTML = "<td>" + meal.name + "</td><td class='price-cell'></td>";
                }
                found_meals = true;
                
                meals_list_body.appendChild(meal_item);
            });
            meals_list.appendChild(meals_list_body);

            if (found_meals) {
                dayContainer.appendChild(meals_list);
                days_with_meals++;
            }
            else {
                var no_meals = document.createElement("p");
                no_meals.className = "no_meals";
                no_meals.innerHTML = "Keine Gerichte gefunden 😢";
                dayContainer.appendChild(no_meals);
            }
            
            tabContent.appendChild(dayContainer);
        });

        // Show 'Show More' button if there are more than 2 days
        var showMoreBtn = this.querySelector("#showMoreBtn");
        showMoreBtn.style.display = (days_with_meals > 2) ? "block" : "none";

        if (days_with_meals == 0) {
            var no_meals = document.createElement("p");
            no_meals.className = "no_meals";
            no_meals.innerHTML = "Keine Gerichte gefunden 😢";
            return no_meals;
        }

        return tabContent;
    }

    setConfig(config) {
        if (!config.mensa_ids || !Array.isArray(config.mensa_ids) || config.mensa_ids.length === 0) {
            throw new Error('You need to define a list of mensa ids!');
        }
        this.config = config;
    }

    static get styles() {
        return `
            :host {
                
            }

            button {
                border: 0;
                background: transparent;
                box-shadow: none;
                border-radius: 0px;
                cursor: pointer;
                padding: 10px 10px;
                transition: all 0.3s ease;
            }

            button:hover, button:focus, button.active {
                background: rgba(255, 255, 255, 0.1);
            }

            #tabBtns {
                display: flex;
                flex-direction: row;
                flex-wrap: wrap;
            }
                
            .tabBtn {
                flex-grow: 1;
                width: fit-content;
                white-space: nowrap;
            }

            .tabBtn.no-meals {
                color: red;
            }

            table {
                width: 100%;
                border-collapse: collapse;
            }

            table tr {
                border-bottom: 1px solid rgba(225, 225, 225, 0.12);
            }

            table tr:last-child {
                border-bottom: none;
            }

            .price-cell {
                text-align: center;
                white-space: nowrap;
                width: 1%;
            }

            .no_meals {
                text-align: center;
            }

            #showMoreBtn {
                width: 100%;
            }
        `;
    }
}

customElements.define('mensa-card', MensaCard);