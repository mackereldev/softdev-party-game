import { Game } from "../room/Game";
import { Quest } from "../schema/quest/Quest";
import { BattleRoom, BossRoom, MarketRoom } from "../schema/quest/QuestRoom";
import { ServerChat } from "./ServerChat";
import { Player } from "../schema/quest/Player";
import { ClientData } from "../schema/ClientData";
import { Enemy } from "../schema/quest/Enemy";

export class QuestHandler {
    private game: Game;

    private get questState() {
        return this.game.state.questState;
    }

    static quests: Quest[] = [
        new Quest(
            "Catacombs",
            () => new BattleRoom("skeleton", "bat"),
            () => new MarketRoom(0),
            () => new BossRoom("giantSkeleton")
        ),
        // new Quest("Dark Forest", ...),
    ];

    private currentQuest: Quest = null;

    constructor(game: Game) {
        this.game = game;
    }

    start = (questIndex: number) => {
        try {
            this.questState.active = true;
            this.currentQuest = QuestHandler.quests[questIndex];
            this.questState.roomIndex = -1;
            this.questState.name = this.currentQuest.name;

            // Join every currently connected player to the quest
            this.game.state.clientData.forEach((client) => this.joinPlayer(client));

            this.game.broadcast("quest-start", undefined, { afterNextPatch: true });
            this.nextRoom();
        } catch (error) {
            console.error("Quest could not be started.");
        }
    };

    nextRoom = () => {
        this.questState.roomIndex++;
        this.questState.room = this.currentQuest.generateRoomByIndex(this.questState.roomIndex);

        if (this.questState.room.type === "battle") {
            this.questState.currentTurn = this.questState.players[0];
        }
    };

    joinPlayer = (client: ClientData, asDead: boolean = false) => {
        this.questState.players.push(new Player(client.clientId, asDead, this.onPlayerDeath));
    };

    leavePlayer = (clientId: string) => {
        const playerIdx = this.questState.players.findIndex((p) => p.clientId === clientId);
        if (playerIdx !== -1) {
            if (this.questState.currentTurn === this.questState.players[playerIdx]) {
                this.nextTurn();
            }
            this.questState.players.deleteAt(playerIdx);

        }
    };

    onPlayerDeath = () => {
        if (this.questState.alivePlayers.length <= 0) {
            this.game.broadcast("server-chat", new ServerChat("game", `All adventurers have died. The quest is over.`).serialize());
            this.stop();
        }
    };

    nextTurn = () => {
        if (!["battle"].includes(this.questState.room?.type)) {
            console.error("Must be in a battle room. (WIP)");
            return;
        }

        const turnIndex = this.questState.turnCycle.indexOf(this.questState.currentTurn);
        this.questState.currentTurn = this.questState.turnCycle[(turnIndex + 1) % this.questState.turnCycle.length];

        // Enemy turn
        if (this.questState.currentTurn instanceof Enemy) {
            this.game.clock.setTimeout(() => {
                const enemy = this.questState.currentTurn as Enemy;
                enemy.takeTurn(this.game, this.questState.alivePlayers);
                this.nextTurn();
            }, 1500);
        }
    };

    voteAdvance = (player: Player) => {
        player.votedForAdvance = true;

        if (this.questState.alivePlayers.every((player) => player.votedForAdvance)) {
            this.advance();
        }
    };

    private advance = () => {
        this.game.questHandler.nextRoom();
        this.game.broadcast("quest-advance", undefined, { afterNextPatch: true });
        this.questState.players.forEach(player => player.votedForAdvance = false);
    };

    stop = () => {
        this.questState.active = false;
        this.currentQuest = null;
        this.questState.roomIndex = -1;
        this.questState.name = "";
        this.questState.currentTurn = null;

        this.questState.players.clear();
    };

    dispose = () => { };
}
