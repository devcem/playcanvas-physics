var Physics = pc.createScript('physics');

Physics.attributes.add('threshold', { type : 'number', default : 1.1 });
Physics.attributes.add('frequency', { type : 'number', default : 1.0 });
Physics.attributes.add('width', { type : 'number', default : 100.0 });
Physics.attributes.add('height', { type : 'number', default : 100.0 });
Physics.prototype.initialize = function() {
    this.kinematicCollisions = [];
    this.recentlyCollided = [];

    this.leavePool = [];
};

Physics.prototype.updateKinematic = function() {
    if(Date.now() - this.lastKinematicUpdate < this.frequency * 1000){
        return false;
    }

    this.kinematicCollisions = [];

    var self = this;

    for(var index in pc.app.systems.collision.store){
        var object = pc.app.systems.collision.store[index];

        if(
            object.entity && 
            object.entity.tags.list().indexOf('Dynamic') > -1
        ){
            if(object.entity.tags.list().indexOf('Ghost') === -1){
                if(!object.entity._translate){
                    object.entity.revertTranslate = function(collision){
                        if(collision == this){
                            return false;
                        }

                        var position  = this.getPosition();
                        if(!position){
                            return false;
                        }

                        var collisionPosition = collision.getPosition();

                        var direction = self.lookAt(
                            collisionPosition.x,
                            collisionPosition.z,
                            position.x,
                            position.z
                        );

                        var distance = position.clone().sub(this.previousPosition).length() * self.threshold;

                        var forceDirection = direction - Math.PI;
                        var posCollisionX = Math.cos(forceDirection) * distance;
                        var posCollisionZ = Math.sin(forceDirection) * distance;

                        this._translate(
                            -posCollisionZ,
                            0,
                            -posCollisionX
                        );
                    };

                    object.entity._translate = object.entity.translate;
                    object.entity.previousPosition = object.entity.getPosition().clone();

                    object.entity.translate = function(x, y, z){
                        if(!this.collision.enabled){
                            this._translate(x, y, z);
                            return false;
                        }

                        var originalPosition = this.getPosition().clone();
                        
                        this.previousPosition = this.getPosition().clone();

                        this._translate(x, y, z);

                        // Check if the new position is outside the map boundaries
                        var newPosition = this.getPosition();
                        if (
                            newPosition.x < -self.width / 2 ||
                            newPosition.x > self.width / 2 ||
                            newPosition.z < -self.height / 2 ||
                            newPosition.z > self.height / 2
                        ) {
                            // If the new position is outside the map size, calculate the force to push back
                            var forceX = 0;
                            var forceZ = 0;

                            if (newPosition.x < -self.width / 2) {
                                forceX = (-self.width / 2) - newPosition.x;
                            } else if (newPosition.x > self.width / 2) {
                                forceX = (self.width / 2) - newPosition.x;
                            }

                            if (newPosition.z < -self.height / 2) {
                                forceZ = (-self.height / 2) - newPosition.z;
                            } else if (newPosition.z > self.height / 2) {
                                forceZ = (self.height / 2) - newPosition.z;
                            }

                            // Apply the force to push back
                            this._translate(forceX, 0, forceZ);
                        }
                    }.bind(object.entity);
                }
            }else{
                object.entity.revertTranslate = function(){};
            }

            this.kinematicCollisions.push(object.entity);
        }
    }

    this.lastKinematicUpdate = Date.now();
};

Physics.prototype.checkCollisions = function(dt) {
    this.triggerPool = [];

    var kinematicIndex = this.kinematicCollisions.length;

    while(kinematicIndex--){
        var kinematicObject = this.kinematicCollisions[kinematicIndex];
        var objects = Object.values(pc.app.systems.collision.store);
        var i = objects.length;

        while(i--){
            var object = objects[i];

            if(
                object && 
                object.entity.parent &&
                object.entity.enabled &&
                object.entity.collision.enabled
            ){
                if(object.data.type == 'sphere'){
                    this.calculateSphereCollision(
                        kinematicObject,
                        object,
                        dt
                    );
                }else if(object.data.type == 'box'){
                    this.calculateBoxCollision(
                        kinematicObject,
                        object,
                        dt
                    );
                }
            }
        }

        //this.triggerPool trigger closest one with while i
        this.triggerPool.sort(function(a, b){
            return a.distance - b.distance;
        });

        if(this.triggerPool.length > 0){
            for(var j = 0; j < this.triggerPool.length; j++){
                var object = this.triggerPool[j];
                var entity = this.triggerPool[j].object.entity;

                //entity.fire('Trigger', kinematicObject, dt);

                
            }   
        }
    }
};

Physics.prototype.calculateSphereCollision = function(kinematicObject, object, dt) {
    if(!kinematicObject){
        return false;
    }

    if(!kinematicObject.collision){
        return false;
    }

    //var distance = kinematicObject.getPosition().clone().sub(object.entity.getPosition().clone()).length();

    var position1 = kinematicObject.getPosition().clone();
    var position2 = object.entity.getPosition().clone();

    /*
    var distance = Utils.distance(
        position1.x,
        position1.z,
        position2.x,
        position2.z
    );
    */
    var distance = position1.distance(position2);
    
    var radius  = object.data.radius;
    var isGhost = object.entity.tags.list().indexOf('Ghost') > -1;

    if(distance < kinematicObject.collision.radius + radius){
        //trigger both parties
        this.triggerPool.push({
            distance : distance,
            object : object
        });

        object.entity.fire('Trigger', kinematicObject, dt);
        kinematicObject.fire('Collision', object.entity);

        this.addTriggerPool(object.entity, kinematicObject);

        if(!isGhost){
            kinematicObject.revertTranslate(object.entity);
        }
    }
};

Physics.prototype.calculateBoxCollision = function(kinematicObject, object, dt) {
    if (!kinematicObject || !kinematicObject.collision) {
        return false;
    }

    var kinematicPos = kinematicObject.getPosition();
    var boxPos = object.entity.getPosition();
    var halfExtents = object.data.halfExtents;
    var kinematicRadius = kinematicObject.collision.radius;
    var isGhost = object.entity.tags.list().indexOf('Ghost') > -1;

    // Calculate the closest point on the box to the kinematic object
    var closestPoint = new pc.Vec3(
        Math.max(boxPos.x - halfExtents.x, Math.min(kinematicPos.x, boxPos.x + halfExtents.x)),
        kinematicPos.y,
        Math.max(boxPos.z - halfExtents.z, Math.min(kinematicPos.z, boxPos.z + halfExtents.z))
    );

    // Calculate the distance between the closest point and the kinematic object
    var distance = kinematicPos.distance(closestPoint);

    if (distance < kinematicRadius) {
        // Collision detected
        this.triggerPool.push({
            distance: distance,
            object: object
        });
        
        object.entity.fire('Trigger', kinematicObject, dt);
        kinematicObject.fire('Collision', object.entity);

        this.addTriggerPool(object.entity, kinematicObject);

        if (!isGhost) {
            // Calculate the collision normal
            var normal = new pc.Vec3();
            normal.sub2(kinematicPos, closestPoint).normalize();

            // Calculate the penetration depth
            var penetrationDepth = kinematicRadius - distance;

            // Apply the force to push back
            var force = normal.scale(penetrationDepth * 1.01); // Slightly over-correct to prevent sticking

            kinematicObject._translate(force.x, 0, force.z);
        }
    }
};

Physics.prototype.addTriggerPool = function(entity, who) {
    var isExist = false;
    var i = this.leavePool.length;

    while(i--){
        var item = this.leavePool[i];

        if(item.entity === entity && item.who === who){
            isExist = true;

            //update time
            item.time = Date.now();
        }
    }

    if(!isExist){
        this.leavePool.push({
            entity : entity,
            who : who,
            time : Date.now()
        });
    }
};

Physics.prototype.updateTriggerPool = function(dt) {
    var i = this.leavePool.length;

    while(i--){
        var item = this.leavePool[i];

        if(Date.now() - item.time > 60.0){
            this.leavePool[i].entity.fire('Leave', this.leavePool[i].who, dt);
            this.leavePool.splice(i, 1);
        }
    }
};

Physics.prototype.update = function(dt) {
    this.updateKinematic();
    this.checkCollisions(dt);

    this.updateTriggerPool(dt);
};

Physics.prototype.lookAt = function(x0, y0, x1, y1){
    return Math.atan2(x1 - x0, y1 - y0);
};
