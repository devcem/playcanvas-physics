var Physics = pc.createScript('physics');

Physics.attributes.add('threshold', { type : 'number', default : 1.1 });
Physics.prototype.initialize = function() {
    this.kinematicCollisions = [];
    this.recentlyCollided = [];
};

Physics.prototype.updateKinematic = function() {
    if(Date.now() - this.lastKinematicUpdate < 1000){
        return false;
    }

    this.kinematicCollisions = [];

    var self = this;
    var objects = Object.values(pc.app.systems.collision.store);
    var i = objects.length;

    while(i--){
        var object = objects[i];

        if(object.entity && object.entity.tags.list().indexOf('Dynamic') > -1){
            if(!object.entity._translate){
                object.entity.revertTranslate = function(collision){
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
                    this.previousPosition = this.getPosition().clone();

                    this._translate(x, y, z);
                }.bind(object.entity);
            }

            this.kinematicCollisions.push(object.entity);
        }
    }

    this.lastKinematicUpdate = Date.now();
};

Physics.prototype.checkCollisions = function(dt) {
    var kinematicIndex = this.kinematicCollisions.length;

    while(kinematicIndex--){
        var kinematicObject = this.kinematicCollisions[kinematicIndex];
        var objects = Object.values(pc.app.systems.collision.store);
        var i = objects.length;

        this.triggerPool = [];

        while(i--){
            var object = objects[i];

            if(
                object && 
                object.entity.parent &&
                object.entity.enabled &&
                object.entity.collision.enabled &&
                object.entity.tags.list().indexOf('Dynamic') === -1
            ){
                if(object.data.type == 'sphere'){
                    this.calculateSphereCollision(
                        kinematicObject,
                        object
                    );
                }else if(object.data.type == 'box'){
                    this.calculateBoxCollision(
                        kinematicObject,
                        object
                    );
                }
            }
        }

        //this.triggerPool trigger closest one with while i
        this.triggerPool.sort(function(a, b){
            return a.distance - b.distance;
        });

        //console.log(this.triggerPool);

        if(this.triggerPool.length > 0){
            for(var j = 0; j < this.triggerPool.length; j++){
                var object = this.triggerPool[j];
                var entity = this.triggerPool[j].object.entity;

                entity.fire('Trigger', kinematicObject, dt);

                var isExist = this.recentlyCollided.find(function(entity){
                    return entity.object == object.object;
                });

                if(!isExist){
                    this.recentlyCollided.push(object);
                }
            }   
        }

        //check this.recentlyCollided and if they dont exist in triggerPool, trigger Leave
        var recentlyCollidedIndex = this.recentlyCollided.length;

        while(recentlyCollidedIndex--){
            var recentlyCollidedObject = this.recentlyCollided[recentlyCollidedIndex];

            var isExist = this.triggerPool.find(function(entity){
                return entity.object == recentlyCollidedObject.object;
            });

            if(!isExist){
                recentlyCollidedObject.object.entity.fire('Leave', kinematicObject, dt);

                this.recentlyCollided.splice(recentlyCollidedIndex, 1);
            }

        }
    }
};

Physics.prototype.calculateSphereCollision = function(kinematicObject, object) {
    var distance = kinematicObject.getPosition().sub(object.entity.getPosition()).length();
    var radius  = object.data.radius;
    var isGhost = object.entity.tags.list().indexOf('Ghost') > -1;

    if(distance < kinematicObject.collision.radius + radius){
        //trigger both parties
        this.triggerPool.push({
            distance : distance,
            object : object
        });

        //object.entity.fire('Trigger', kinematicObject);
        kinematicObject.fire('Collision', object.entity);

        if(!isGhost){
            kinematicObject.revertTranslate(object.entity);
        }
    }
};

Physics.prototype.calculateBoxCollision = function(kinematicObject, object) {
    var distance = kinematicObject.getPosition().sub(object.entity.getPosition()).length();
    var kinematicObjectPosition = kinematicObject.getPosition();
    var kinematicRadius = kinematicObject.collision.radius;
    var position = object.entity.getPosition();
    var halfExtents = object.data.halfExtents;
    var isGhost = object.entity.tags.list().indexOf('Ghost') > -1;

    //check if sphere kinematic object is in halfExtents area, include kinematicRadius
	
    if(
        kinematicObjectPosition.x > position.x - halfExtents.x - kinematicRadius &&
        kinematicObjectPosition.x < position.x + halfExtents.x + kinematicRadius &&
        kinematicObjectPosition.z > position.z - halfExtents.z - kinematicRadius &&
        kinematicObjectPosition.z < position.z + halfExtents.z + kinematicRadius
    ){
        //trigger both parties
        this.triggerPool.push({
            distance : distance,
            object : object
        });
        
        //object.entity.fire('Trigger', kinematicObject);
        kinematicObject.fire('Collision', object.entity);

        if(!isGhost){
            kinematicObject.revertTranslate(object.entity);
        }
    }
};

Physics.prototype.update = function(dt) {
    this.updateKinematic();
    this.checkCollisions(dt);
};

Physics.prototype.lookAt = function(x0, y0, x1, y1){
    return Math.atan2(x1 - x0, y1 - y0);
};
