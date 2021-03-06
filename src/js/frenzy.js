/**
 * This is the frenzy state, in which the user has 3 seconds to try to collect (by tapping) as many eggs as possible
 */
var frenzyState = {

    bonusPointsFrenzy: 50,
    xVelocityFrenzyEgg: 100, // This is used to regulate the horizontal vibration of the eggs
    durationOfFrenzyState: 3,
    probabilityOfAddingFrenzyEgg: 0.75, // When drawing eggs, there is 75 percent chance it draws a frenzy egg instead of a bomb


    create: function(){
        gameController.addBackground();
        this.frenzyEggPoints = gameController.frenzyPoints;
        this.numberOfEggsAddedToScreen = 0; // initially 0 eggs are added to the screen
        this.hasAchievedBonus = false; // flag to check if the user has achieved the bonus
        this.frenzyTime = 0; // current time within the frenzy state

        this.createFrenzyTimer(); // creates the timer at the top of the screen to remind the user of the duration of the frenzy state

        gameController.createScoreText();
        this.frenzyStateGroup = game.add.group();

        // creates a frenzy egg off the screen in order to determine the minimum distance between points in the poisson disk sampling
        this.minDistanceBetweenPoints = this.createFrenzyEgg(-500, -500);

        this.points = this.generatePoints();
        this.drawEggsAtPoints(this.points);
        this.numberOfEggsCollected = 0; // initially set the number of eggs the user has collected to 0
        this.elapsedTime = 0;

        gameController.createHeart();

        // every 1s (1000ms), the time in the frenzy state increases and the timer text at the top of screen is updated
        game.time.events.loop(1000, function(){
            if (this.frenzyTime >= this.durationOfFrenzyState){
                gameController.frenzyMusic.stop();
                backgroundMusic.play();
                this.game.state.start('play');
            } else{
                this.frenzyTime ++;
                this.timer.text = this.durationOfFrenzyState - this.frenzyTime;
            }
        }, this);

    },


    /**
     * This is the update function, which we added with some help from Bret Jackson.
     * This function manages the vibration of the eggs in the frenzy state.
     * This function also controls how the bonus points are added.
     */
    update: function(){

        //every 150ms, the x-velocity flips, in order to help the eggs switch directions.
        this.elapsedTime += game.time.physicsElapsedMS;
        if (this.elapsedTime >= 150) {
            this.changeXVelocityOfEgg();
            this.frenzyStateGroup.forEach(function (egg) {
                egg.body.velocity.x = this.xVelocityFrenzyEgg;
            }, this);
            this.elapsedTime = 0;
        }

        // determines what happens if user has collected all frenzy eggs and hasnt achieved the bonus
        if (this.numberOfEggsCollected == this.numberOfEggsAddedToScreen && !this.hasAchievedBonus){
            this.hasAchievedBonus = true; //readjusts the flag, in order to prevent the bonus score to keep adding over and over again
            gameController.score += this.bonusPointsFrenzy;
            gameController.scoreText.text = "Score: " + gameController.score;
            this.playBonusReceivedAnimation();
        }

        // adjusts highscores
        if (gameController.score > gameController.highestScore){
            gameController.highestScore = gameController.score;
        }

    },

    /**
     * Creates a timer at the top of the screen in the frenzy state
     */
    createFrenzyTimer: function () {
        var frenzyTimerFormatting = gameController.createFormatting("bold 50pt Corbel", "#ff0000");

        //timer is added with a y-spacing of 3% of the canvas height. Adjust the scale ratio and properly centralise things
        this.timer = game.add.text(canvasWidth / 2, 0.03 * canvasHeight, this.durationOfFrenzyState, frenzyTimerFormatting);
        this.timer.anchor.setTo(0.5, 0.5);
        this.timer.scale.setTo(scaleRatio, scaleRatio);
    },

    /**
     * This plays the animation when the user has achieved the bonus (catching all the frenzy eggs in the state)
     */
    playBonusReceivedAnimation: function(){
        var bonusPointsFormat = gameController.createFormatting("bold 100pt Corbel", "#FF00FF");
        var bonusText = "BONUS: +" + this.bonusPointsFrenzy;
        gameController.createTweenAnimation(game.world.centerX, game.world.centerY, bonusText , bonusPointsFormat);
    },

    /**
     * This uses the poisson disk sampler to generate an array of coordinates to put the frenzy eggs
     * @returns {Array} - contains the coordinates at which we will add frenzy eggs or bombs
     */
    generatePoints: function(){
        var poissonDiskSampler = new PoissonDiskSampler();

        //Sets the minimum and maximum distance between two points.
        poissonDiskSampler.radiusMin = this.minDistanceBetweenPoints/2;
        poissonDiskSampler.radiusMax = this.minDistanceBetweenPoints/2;

        poissonDiskSampler.createPoints();
        return poissonDiskSampler.pointList;
    },

    /**
     * Takes an array of coordinates and draws frenzy eggs or bombs there
     * @param points - an array containing coordinates
     */
    drawEggsAtPoints: function(points){

        let eggOffset = 50; //offset value to prevent eggs from going off screen

        //set horizontal and vertical offsets to control positions at which the eggs are created
        var xOffSet = 0.1 * (canvasWidth-eggOffset);
        var topYOffSet = 0.15 * canvasHeight;
        var bottomYOffSet = 0.2 * canvasHeight;

        //
        for (var i = 0; i < points.length; i++){
            let coordinate = points[i];
            if ((coordinate.x > xOffSet) && (coordinate.x < (canvasWidth - xOffSet))
                && (coordinate.y > topYOffSet) && (coordinate.y < (canvasHeight - bottomYOffSet))){
                var prob = Math.random(); //generate a number between 0 and 1

                if (prob < this.probabilityOfAddingFrenzyEgg){
                    this.createFrenzyEgg(coordinate.x, coordinate.y, "frenzy");
                    this.numberOfEggsAddedToScreen++;
                } else{
                    this.createFrenzyEgg(coordinate.x, coordinate.y, "bomb");
                }
            }
        }
    },

    /**
     * Handles what happens when a bomb is collected
     * @param egg - the egg (bomb) that is collected
     */
    collectBomb: function(egg){
        gameController.lives--;
        gameController.updateLifeCountLabel();
        playState.calculateEggProbability(gameController.currentTime);
        egg.kill();
        if (gameController.lives == 0){
            gameController.explosion.play();
            gameController.frenzyMusic.stop();
            this.game.state.start('gameOver');
        } else{
            gameController.bombCollect.play();
        }


    },

    /**
     * creates a frenzy egg or bomb
     * @param eggX - the x-coordinate
     * @param eggY - the y-coordinate
     * @param eggName - the egg type; either "bomb" or "egg"
     * @returns {number} - returns the diagonal length of an egg
     */
    createFrenzyEgg: function (eggX, eggY, eggName) {
        var frenzyEgg = game.add.sprite(eggX, eggY, eggName);

        // sets up physical properties of egg
        game.physics.arcade.enable(frenzyEgg, Phaser.Physics.ARCADE);
        game.physics.arcade.enable(frenzyEgg);
        frenzyEgg.scale.setTo(scaleRatio * 1.5, scaleRatio * 1.5);
        frenzyEgg.body.kinematic = true;
        frenzyEgg.inputEnabled = true;
        frenzyEgg.input.enableDrag(false, true, true);
        frenzyEgg.input.allowVerticalDrag = true;
        frenzyEgg.collideWorldBounds = true;
        frenzyEgg.body.immovable = true;
        this.frenzyStateGroup.add(frenzyEgg);

        // Spacing between "Play" and "How to Play" button
        if (eggName == "frenzy"){
            frenzyEgg.events.onInputDown.add(this.collectEgg, this); x
        } else{
            frenzyEgg.events.onInputDown.add(this.collectBomb, this);
        }
        var distanceSquared = Math.pow(frenzyEgg.width, 2) + Math.pow(frenzyEgg.height, 2);
        var distance = Math.pow(distanceSquared, 0.5);

        return distance;
    },

    /**
     * reverses the direction of the x-velocity
     */
    changeXVelocityOfEgg: function(){
        this.xVelocityFrenzyEgg = -1 * this.xVelocityFrenzyEgg;
    },

    /**
     * This controls what happens when an egg is clicked
     * @param egg - the egg that is touched/clicked
     */
    collectEgg: function(egg){
        let eggX = egg.x;
        let eggY = egg.y;
        egg.kill();
        gameController.frenzyTouch.play();
        this.numberOfEggsCollected++;
        this.showScoreAnimation(eggX, eggY, this.frenzyEggPoints);
        gameController.score += this.frenzyEggPoints;
        gameController.scoreText.text = "Score: " + gameController.score;
    },

    /**
     * Plays the animation pop-up when an egg is touched
     * @param xCoordinate
     * @param yCoordinate
     * @param numberOfPoints - number of points that are added to the score and displayed on the screen where the user touched egg
     */
    showScoreAnimation: function(xCoordinate, yCoordinate, numberOfPoints){
        var tweenSpeed = 500;
        var scoreTextFormat = gameController.createFormatting("bold 40pt Corbel", "#003366");
        gameController.createTweenAnimation(xCoordinate, yCoordinate, numberOfPoints, scoreTextFormat, 700, tweenSpeed);
    },

};