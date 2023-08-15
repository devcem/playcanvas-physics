var Physics = pc.createScript('physics');

Physics.attributes.add('threshold', { type : 'number', default : 1.1 });
Physics.prototype.initialize = function() {
    this.kinematicCollisions = [];
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

        while(i--){
            var object = objects[i];

            if(
                object && 
                object.entity.parent &&
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
    }
};

Physics.prototype.calculateSphereCollision = function(kinematicObject, object) {
    var distance = kinematicObject.getPosition().sub(object.entity.getPosition()).length();
    var radius  = object.data.radius;
    var isGhost = object.entity.tags.list().indexOf('Ghost') > -1;

    if(distance < kinematicObject.collision.radius + radius){
        //trigger both parties
        object.entity.fire('Trigger', kinematicObject);
        kinematicObject.fire('Collision', object.entity);

        if(!isGhost){
            kinematicObject.revertTranslate(object.entity);
        }
    }
};

Physics.prototype.calculateBoxCollision = function(kinematicObject, object) {
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
        object.entity.fire('Trigger', kinematicObject);
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
