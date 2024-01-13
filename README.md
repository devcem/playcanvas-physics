# playcanvas-physics
Simple physics for casual games, it's 2D. It only supports sphere + sphere and sphere + AABB box collisions.

## Steps
- Download Physics.js
- Put it into your project
- Attach it to Root
- Done!

## Object Types
You can define your object type with simple tags, supported tags:
- `Dynamic`
- `Ghost`

Objects that doesn't have any of these tags above will be static if they have collision component.

## Events
You can listen events like these:

- `this.entity.on('Trigger', object, dt)`
- `this.entity.on('Leave')`
- `this.entity.on('Collision')`

Trigger is on triggered object, collision is on dynamic object, it gives which object we collided.

## What you can do?
- Simple games including mobile
- 2kb super simple engine, loads instantly
- 2D movement, or simple topdown perspective, isometric movement type of games

## Tutorial Video
https://www.youtube.com/watch?v=0oDCl_D34X8&ab_channel=CemDemir

## Demo
https://playcanv.as/b/2c3f7dd2

## Sample Project
https://playcanvas.com/project/1127019/overview/simple-physics-box--sphere
