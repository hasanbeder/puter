const { LLMkdir } = require("../filesystem/ll_operations/ll_mkdir");
const { RootNodeSelector } = require("../filesystem/node/selectors");
const { invalidate_cached_user } = require("../helpers");
const BaseService = require("./BaseService");
const { DB_WRITE } = require("./database/consts");

class UserService extends BaseService {
    static MODULES = {
        uuidv4: require('uuid').v4,
    };

    async _init () {
        this.db = this.services.get('database').get(DB_WRITE, 'user-service');
    }

    // used to be called: generate_system_fsentries
    async generate_default_fsentries ({ user }) {
        
        this.log.noticeme('YES THIS WAS USED');
        
        // Note: The comment below is outdated as we now do parallel writes for
        //       all filesystem operations. However, there may still be some
        //       performance hit so this requires further investigation.

        // Normally, it is recommended to use mkdir() to create new folders,
        // but during signup this could result in multiple queries to the DB server
        // and for servers in remote regions such as Asia this could result in a
        // very long time for /signup to finish, sometimes up to 30-40 seconds!
        // by combining as many queries as we can into one and avoiding multiple back-and-forth
        // with the DB server, we can speed this process up significantly.

        const ts = Date.now()/1000;

        // Generate UUIDs for all the default folders and files
        const uuidv4 = this.modules.uuidv4;

        let home_uuid = uuidv4();
        let trash_uuid = uuidv4();
        let appdata_uuid = uuidv4();
        let desktop_uuid = uuidv4();
        let documents_uuid = uuidv4();
        let pictures_uuid = uuidv4();
        let videos_uuid = uuidv4();
        let public_uuid = uuidv4();

        const insert_res = await this.db.write(
            `INSERT INTO fsentries
            (uuid, parent_uid, user_id, name, path, is_dir, created, modified, immutable) VALUES
            (   ?,          ?,       ?,    ?,    ?,   true,       ?,        ?,      true),
            (   ?,          ?,       ?,    ?,    ?,   true,       ?,        ?,      true),
            (   ?,          ?,       ?,    ?,    ?,   true,       ?,        ?,      true),
            (   ?,          ?,       ?,    ?,    ?,   true,       ?,        ?,      true),
            (   ?,          ?,       ?,    ?,    ?,   true,       ?,        ?,      true),
            (   ?,          ?,       ?,    ?,    ?,   true,       ?,        ?,      true),
            (   ?,          ?,       ?,    ?,    ?,   true,       ?,        ?,      true),
            (   ?,          ?,       ?,    ?,    ?,   true,       ?,        ?,      true)
            `,
            [
                // Home
                home_uuid, null, user.id, user.username, `/${user.username}`, ts, ts,
                // Trash
                trash_uuid, home_uuid, user.id, 'Trash', `/${user.username}/Trash`, ts, ts,
                // AppData
                appdata_uuid, home_uuid, user.id, 'AppData', `/${user.username}/AppData`, ts, ts,
                // Desktop
                desktop_uuid, home_uuid, user.id, 'Desktop', `/${user.username}/Desktop`, ts, ts,
                // Documents
                documents_uuid, home_uuid, user.id, 'Documents', `/${user.username}/Documents`, ts, ts,
                // Pictures
                pictures_uuid, home_uuid, user.id, 'Pictures', `/${user.username}/Pictures`, ts, ts,
                // Videos
                videos_uuid, home_uuid, user.id, 'Videos', `/${user.username}/Videos`, ts, ts,
                // Public
                public_uuid, home_uuid, user.id, 'Public', `/${user.username}/Public`, ts, ts,
            ]
        );

        // https://stackoverflow.com/a/50103616
        let trash_id = insert_res.insertId;
        let appdata_id = insert_res.insertId + 1;
        let desktop_id = insert_res.insertId + 2;
        let documents_id = insert_res.insertId + 3;
        let pictures_id = insert_res.insertId + 4;
        let videos_id = insert_res.insertId + 5;
        let public_id = insert_res.insertId + 6;

        // Asynchronously set the user's system folders uuids in database
        // This is for caching purposes, so we don't have to query the DB every time we need to access these folders
        // This is also possible because we know the user's system folders uuids will never change

        // TODO: pass to IIAFE manager to avoid unhandled promise rejection
        // (IIAFE manager doesn't exist yet, hence this is a TODO)
        this.db.write(
            `UPDATE user SET
            trash_uuid=?, appdata_uuid=?, desktop_uuid=?, documents_uuid=?, pictures_uuid=?, videos_uuid=?, public_uuid=?,
            trash_id=?, appdata_id=?, desktop_id=?, documents_id=?, pictures_id=?, videos_id=?, public_id=?

            WHERE id=?`,
            [
                trash_uuid, appdata_uuid, desktop_uuid, documents_uuid, pictures_uuid, videos_uuid, public_uuid,
                trash_id, appdata_id, desktop_id, documents_id, pictures_id, videos_id, public_id,
                user.id
            ]
        );
        invalidate_cached_user(user);
    }
}

module.exports = {
    UserService,
};
